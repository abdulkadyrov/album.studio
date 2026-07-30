import JSZip from 'jszip';

import {
  normalizeDocumentOrder,
  type CanvasDocument,
  type CanvasLayerSnapshot,
} from '../../canvas/model/canvas-document';
import { systemTemplates } from '../../features/templates/system-templates';
import {
  templateManifestSchema,
  type TemplateCategory,
  type TemplateColor,
  type TemplateManifest,
  type TemplateStyle,
} from '../../features/templates/template-schema';
import { database } from '../db/database';
import type { AssetRecord, TemplateRecord } from '../db/schema';
import { canvasSceneRepository } from './canvas-scene-repository';

const MAX_TEMPLATE_BYTES = 500 * 1024 * 1024;
const MAX_TEMPLATE_FILES = 5000;
const systemAssetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const SYSTEM_IMAGE_ASSETS = [
  {
    id: 'system-editorial-burgundy-students',
    url: systemAssetUrl('generated/editorial-burgundy-students.png'),
    filename: 'editorial-burgundy-students.png',
    widthPx: 1448,
    heightPx: 1086,
  },
  {
    id: 'system-editorial-burgundy-teachers',
    url: systemAssetUrl('generated/editorial-burgundy-teachers.png'),
    filename: 'editorial-burgundy-teachers.png',
    widthPx: 1536,
    heightPx: 1024,
  },
] as const;

export interface SaveTemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  style: TemplateStyle;
  color: TemplateColor;
  scope: 'project' | 'page';
  pageId?: string;
}

function toRecord(manifest: TemplateManifest): TemplateRecord {
  return {
    id: manifest.template.id,
    name: manifest.template.name,
    category: manifest.template.category,
    style: manifest.template.style,
    favorite: manifest.template.favorite ? 1 : 0,
    updatedAt: manifest.template.updatedAt,
    payload: manifest,
  };
}

function referencedAssetIds(document: CanvasDocument): string[] {
  return [
    ...new Set(
      document.layers.flatMap((layer) => [
        ...(layer.image
          ? [
              layer.image.assetId,
              ...(layer.image.thumbnailAssetId ? [layer.image.thumbnailAssetId] : []),
              ...(layer.image.svgMaskAssetId ? [layer.image.svgMaskAssetId] : []),
            ]
          : []),
        ...(layer.text?.fontAssetId ? [layer.text.fontAssetId] : []),
      ]),
    ),
  ];
}

async function cloneAssets(
  document: CanvasDocument,
  owner: { ownerType: AssetRecord['ownerType']; projectId?: string; prefix: string },
): Promise<{ document: CanvasDocument; assets: AssetRecord[] }> {
  const sourceIds = referencedAssetIds(document);
  const sourceRecords = await database.assets.bulkGet(sourceIds);
  const foundRecords = sourceRecords.filter((record): record is AssetRecord => Boolean(record));
  const idMap = new Map(
    foundRecords.map((record) => [record.id, `${owner.prefix}-${crypto.randomUUID()}`]),
  );
  const assets = foundRecords.map((record) => ({
    ...record,
    id: idMap.get(record.id)!,
    projectId: owner.projectId,
    ownerType: owner.ownerType,
    sourceAssetId: record.sourceAssetId
      ? (idMap.get(record.sourceAssetId) ?? record.sourceAssetId)
      : undefined,
    metadata: record.metadata
      ? {
          ...record.metadata,
          ...(typeof record.metadata.thumbnailAssetId === 'string'
            ? {
                thumbnailAssetId:
                  idMap.get(record.metadata.thumbnailAssetId) ?? record.metadata.thumbnailAssetId,
              }
            : {}),
        }
      : undefined,
    createdAt: new Date().toISOString(),
  }));
  const layers = document.layers.map(
    (layer): CanvasLayerSnapshot => ({
      ...layer,
      text:
        layer.text?.fontAssetId && idMap.has(layer.text.fontAssetId)
          ? { ...layer.text, fontAssetId: idMap.get(layer.text.fontAssetId)! }
          : layer.text,
      image: layer.image
        ? {
            ...layer.image,
            assetId: idMap.get(layer.image.assetId) ?? layer.image.assetId,
            thumbnailAssetId: layer.image.thumbnailAssetId
              ? (idMap.get(layer.image.thumbnailAssetId) ?? layer.image.thumbnailAssetId)
              : undefined,
            svgMaskAssetId: layer.image.svgMaskAssetId
              ? (idMap.get(layer.image.svgMaskAssetId) ?? layer.image.svgMaskAssetId)
              : undefined,
          }
        : undefined,
    }),
  );
  return { document: { ...document, layers }, assets };
}

function assetDescriptors(assets: AssetRecord[]): TemplateManifest['assets'] {
  return assets.map((asset) => ({
    id: asset.id,
    path: `assets/${asset.id}`,
    filename: asset.filename,
    mimeType: asset.mimeType,
    kind: asset.kind,
    byteSize: asset.byteSize,
    hash: asset.hash,
    sourceAssetId: asset.sourceAssetId,
    metadata: asset.metadata,
  }));
}

function subsetDocument(document: CanvasDocument, scope: 'project' | 'page', pageId?: string) {
  if (scope === 'project') return structuredClone(document);
  const selectedPage = document.pages.find((page) => page.id === pageId) ?? document.pages[0]!;
  const layerIds = new Set(
    document.layers.filter((layer) => layer.pageId === selectedPage.id).map((layer) => layer.id),
  );
  return {
    ...structuredClone(document),
    pages: [{ ...selectedPage, order: 0, spreadId: undefined, spreadSide: undefined }],
    layers: document.layers.filter(
      (layer) =>
        layer.pageId === selectedPage.id && (!layer.parentId || layerIds.has(layer.parentId)),
    ),
  };
}

function remapDocument(document: CanvasDocument, projectId: string): CanvasDocument {
  const pageIdMap = new Map(
    document.pages.map((page) => [page.id, `${projectId}:page-${crypto.randomUUID()}`]),
  );
  const spreadIdMap = new Map(
    document.pages.flatMap((page) =>
      page.spreadId && !pageIdMap.has(page.spreadId)
        ? [[page.spreadId, `${projectId}:spread-${crypto.randomUUID()}`] as const]
        : [],
    ),
  );
  const layerIdMap = new Map(
    document.layers.map((layer) => [layer.id, `${projectId}:layer-${crypto.randomUUID()}`]),
  );
  return normalizeDocumentOrder({
    ...structuredClone(document),
    projectId,
    pages: document.pages.map((page) => ({
      ...page,
      id: pageIdMap.get(page.id)!,
      spreadId: page.spreadId ? spreadIdMap.get(page.spreadId) : undefined,
    })),
    layers: document.layers.map((layer) => ({
      ...layer,
      id: layerIdMap.get(layer.id)!,
      pageId: pageIdMap.get(layer.pageId)!,
      parentId: layer.parentId ? layerIdMap.get(layer.parentId) : undefined,
    })),
    updatedAt: new Date().toISOString(),
  });
}

async function ensureSystemTemplates(): Promise<void> {
  const existingRecords = await database.templates.bulkGet(
    systemTemplates.map((manifest) => manifest.template.id),
  );
  const favorites = new Map(
    existingRecords.flatMap((record) => (record ? [[record.id, record.favorite] as const] : [])),
  );
  await database.templates.bulkPut(
    systemTemplates.map((manifest) => ({
      ...toRecord(manifest),
      favorite: favorites.get(manifest.template.id) ?? 0,
    })),
  );

  const existingAssetIds = new Set(
    await database.assets
      .bulkGet(SYSTEM_IMAGE_ASSETS.map((item) => item.id))
      .then((records) => records.flatMap((record) => (record ? [record.id] : []))),
  );
  const missingAssets = SYSTEM_IMAGE_ASSETS.filter((item) => !existingAssetIds.has(item.id));
  if (missingAssets.length === 0) return;
  try {
    const records = await Promise.all(
      missingAssets.map(async (item): Promise<AssetRecord> => {
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`Не удалось загрузить ${item.filename}`);
        const blob = await response.blob();
        return {
          id: item.id,
          ownerType: 'system',
          kind: 'image',
          filename: item.filename,
          mimeType: 'image/png',
          byteSize: blob.size,
          blob,
          metadata: { widthPx: item.widthPx, heightPx: item.heightPx },
          createdAt: new Date().toISOString(),
        };
      }),
    );
    await database.assets.bulkPut(records);
  } catch {
    // В unit-тестах нет HTTP-сервера; шаблон остаётся доступным с кликабельными плейсхолдерами.
  }
}

export const templateRepository = {
  async list(): Promise<TemplateManifest[]> {
    await ensureSystemTemplates();
    const records = await database.templates.orderBy('updatedAt').reverse().toArray();
    return records.flatMap((record) => {
      const parsed = templateManifestSchema.safeParse(record.payload);
      return parsed.success
        ? [
            {
              ...parsed.data,
              template: { ...parsed.data.template, favorite: record.favorite === 1 },
            },
          ]
        : [];
    });
  },

  async get(id: string): Promise<TemplateManifest | undefined> {
    await ensureSystemTemplates();
    const record = await database.templates.get(id);
    if (!record) return undefined;
    const parsed = templateManifestSchema.safeParse(record.payload);
    return parsed.success
      ? { ...parsed.data, template: { ...parsed.data.template, favorite: record.favorite === 1 } }
      : undefined;
  },

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await database.templates.update(id, { favorite: favorite ? 1 : 0 });
  },

  async saveFromDocument(
    document: CanvasDocument,
    input: SaveTemplateInput,
  ): Promise<TemplateManifest> {
    const id = `user-template-${crypto.randomUUID()}`;
    const scoped = subsetDocument(document, input.scope, input.pageId);
    const copied = await cloneAssets(scoped, { ownerType: 'template', prefix: id });
    const now = new Date().toISOString();
    const manifest: TemplateManifest = templateManifestSchema.parse({
      format: 'vakha-template',
      version: 1,
      template: {
        id,
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        category: input.category,
        style: input.style,
        color: input.color,
        orientation:
          copied.document.pages[0]!.widthMm === copied.document.pages[0]!.heightMm
            ? 'square'
            : copied.document.pages[0]!.widthMm > copied.document.pages[0]!.heightMm
              ? 'landscape'
              : 'portrait',
        source: 'user',
        favorite: false,
        createdAt: now,
        updatedAt: now,
      },
      document: { ...copied.document, projectId: id, updatedAt: now },
      assets: assetDescriptors(copied.assets),
    });
    await database.transaction('rw', database.templates, database.assets, async () => {
      if (copied.assets.length > 0) await database.assets.bulkPut(copied.assets);
      await database.templates.put(toRecord(manifest));
    });
    return manifest;
  },

  async createProject(templateId: string): Promise<string> {
    const manifest = await this.get(templateId);
    if (!manifest) throw new Error('Шаблон не найден');
    const projectId = `project-${crypto.randomUUID()}`;
    const remapped = remapDocument(manifest.document, projectId);
    const copied = await cloneAssets(remapped, {
      ownerType: 'project',
      projectId,
      prefix: projectId,
    });
    const now = new Date().toISOString();
    await database.transaction('rw', database.assets, database.projects, async () => {
      if (copied.assets.length > 0) await database.assets.bulkPut(copied.assets);
      await database.projects.put({
        id: projectId,
        name: manifest.template.name,
        schoolName: '',
        className: '',
        academicYear: new Date().getFullYear().toString(),
        status: 'draft',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    });
    await canvasSceneRepository.save(copied.document);
    return projectId;
  },

  async duplicate(id: string): Promise<TemplateManifest> {
    const source = await this.get(id);
    if (!source) throw new Error('Шаблон не найден');
    const newId = `user-template-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const copied = await cloneAssets(source.document, { ownerType: 'template', prefix: newId });
    const manifest: TemplateManifest = {
      ...source,
      template: {
        ...source.template,
        id: newId,
        name: `${source.template.name} — копия`,
        source: 'user',
        favorite: false,
        createdAt: now,
        updatedAt: now,
      },
      document: { ...copied.document, projectId: newId, updatedAt: now },
      assets: assetDescriptors(copied.assets),
    };
    await database.transaction('rw', database.templates, database.assets, async () => {
      if (copied.assets.length > 0) await database.assets.bulkPut(copied.assets);
      await database.templates.put(toRecord(manifest));
    });
    return manifest;
  },

  async rename(id: string, name: string): Promise<void> {
    const manifest = await this.get(id);
    if (!manifest || manifest.template.source === 'system')
      throw new Error('Системный шаблон нельзя переименовать');
    manifest.template.name = name.trim();
    manifest.template.updatedAt = new Date().toISOString();
    await database.templates.put(toRecord(manifest));
  },

  async delete(id: string): Promise<void> {
    const manifest = await this.get(id);
    if (!manifest || manifest.template.source === 'system')
      throw new Error('Системный шаблон нельзя удалить');
    await database.transaction('rw', database.templates, database.assets, async () => {
      await database.templates.delete(id);
      await database.assets.bulkDelete(manifest.assets.map((asset) => asset.id));
    });
  },

  async export(id: string): Promise<Blob> {
    const manifest = await this.get(id);
    if (!manifest) throw new Error('Шаблон не найден');
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    for (const asset of manifest.assets) {
      const record = await database.assets.get(asset.id);
      if (!record) throw new Error(`Ресурс «${asset.filename}» отсутствует`);
      zip.file(asset.path, record.blob);
    }
    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  },

  async import(file: File): Promise<TemplateManifest> {
    if (file.size <= 0 || file.size > MAX_TEMPLATE_BYTES)
      throw new Error('Размер шаблона превышает 500 МБ');
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);
    if (entries.length > MAX_TEMPLATE_FILES) throw new Error('В шаблоне слишком много файлов');
    for (const entry of entries) {
      const original = entry.unsafeOriginalName ?? entry.name;
      if (original.startsWith('/') || original.split(/[\\/]/).includes('..'))
        throw new Error('Шаблон содержит небезопасный путь');
    }
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) throw new Error('В шаблоне отсутствует manifest.json');
    const parsed = templateManifestSchema.parse(JSON.parse(await manifestEntry.async('text')));
    const newId = `imported-template-${crypto.randomUUID()}`;
    const idMap = new Map(
      parsed.assets.map((asset) => [asset.id, `${newId}-${crypto.randomUUID()}`]),
    );
    let totalBytes = 0;
    const assets: AssetRecord[] = [];
    for (const asset of parsed.assets) {
      const entry = zip.file(asset.path);
      if (!entry) throw new Error(`Ресурс «${asset.filename}» отсутствует в архиве`);
      const blob = await entry.async('blob');
      totalBytes += blob.size;
      if (blob.size !== asset.byteSize || totalBytes > MAX_TEMPLATE_BYTES)
        throw new Error('Размер ресурса шаблона не совпадает с manifest');
      assets.push({
        id: idMap.get(asset.id)!,
        ownerType: 'template',
        kind: asset.kind,
        filename: asset.filename,
        mimeType: asset.mimeType,
        byteSize: blob.size,
        blob,
        hash: asset.hash,
        sourceAssetId: asset.sourceAssetId ? idMap.get(asset.sourceAssetId) : undefined,
        metadata: asset.metadata
          ? {
              ...asset.metadata,
              ...(typeof asset.metadata.thumbnailAssetId === 'string'
                ? {
                    thumbnailAssetId:
                      idMap.get(asset.metadata.thumbnailAssetId) ?? asset.metadata.thumbnailAssetId,
                  }
                : {}),
            }
          : undefined,
        createdAt: new Date().toISOString(),
      });
    }
    const remappedLayers = parsed.document.layers.map((layer) => ({
      ...layer,
      text:
        layer.text?.fontAssetId && idMap.has(layer.text.fontAssetId)
          ? { ...layer.text, fontAssetId: idMap.get(layer.text.fontAssetId)! }
          : layer.text,
      image: layer.image
        ? {
            ...layer.image,
            assetId: idMap.get(layer.image.assetId) ?? layer.image.assetId,
            thumbnailAssetId: layer.image.thumbnailAssetId
              ? idMap.get(layer.image.thumbnailAssetId)
              : undefined,
            svgMaskAssetId: layer.image.svgMaskAssetId
              ? idMap.get(layer.image.svgMaskAssetId)
              : undefined,
          }
        : undefined,
    }));
    const now = new Date().toISOString();
    const manifest: TemplateManifest = templateManifestSchema.parse({
      ...parsed,
      template: {
        ...parsed.template,
        id: newId,
        source: parsed.template.source === 'codex' ? 'codex' : 'user',
        favorite: false,
        createdAt: now,
        updatedAt: now,
      },
      document: { ...parsed.document, projectId: newId, layers: remappedLayers, updatedAt: now },
      assets: parsed.assets.map((asset) => ({
        ...asset,
        id: idMap.get(asset.id)!,
        path: `assets/${idMap.get(asset.id)!}`,
        sourceAssetId: asset.sourceAssetId ? idMap.get(asset.sourceAssetId) : undefined,
        metadata: asset.metadata
          ? {
              ...asset.metadata,
              ...(typeof asset.metadata.thumbnailAssetId === 'string'
                ? {
                    thumbnailAssetId:
                      idMap.get(asset.metadata.thumbnailAssetId) ?? asset.metadata.thumbnailAssetId,
                  }
                : {}),
            }
          : undefined,
      })),
    });
    await database.transaction('rw', database.templates, database.assets, async () => {
      if (assets.length > 0) await database.assets.bulkPut(assets);
      await database.templates.put(toRecord(manifest));
    });
    return manifest;
  },
};
