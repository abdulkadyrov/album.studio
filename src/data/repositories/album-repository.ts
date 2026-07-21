import JSZip from 'jszip';

import { canvasSceneRepository } from './canvas-scene-repository';
import { database } from '../db/database';
import type {
  AssetRecord,
  OverrideRecord,
  ParticipantPhotoRecord,
  ParticipantRecord,
  ProjectRecord,
} from '../db/schema';
import { albumManifestSchema, type AlbumManifest } from '../../features/album/album-schema';
import type { CanvasDocument, CanvasLayerSnapshot } from '../../canvas/model/canvas-document';

const MAX_ALBUM_BYTES = 1024 * 1024 * 1024;
const MAX_ALBUM_FILES = 10000;

function assertSafePath(path: string): void {
  if (path.startsWith('/') || path.split(/[\\/]/).includes('..')) {
    throw new Error('Альбом содержит небезопасный путь');
  }
}

function safeName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'album'
  );
}

function participantName(person: ParticipantRecord): string {
  return (
    person.displayName ||
    [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')
  );
}

function toManifestParticipant(person: ParticipantRecord, photos: ParticipantPhotoRecord[]) {
  return {
    externalId: person.externalId ?? person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName,
    displayName: participantName(person),
    role: person.role,
    email: person.email,
    phone: person.phone,
    notes: person.notes,
    tags: person.tags ?? [],
    status: person.status,
    photos: photos.map((photo) => ({
      path: `assets/${photo.assetId}`,
      role: photo.role,
      order: photo.order,
    })),
  };
}

function assetIdFromManifestPath(path: string): string {
  return path.startsWith('assets/') ? path.slice('assets/'.length) : path;
}

async function zipAssetData(asset: AssetRecord): Promise<Blob | ArrayBuffer | Uint8Array | string> {
  const value = asset.blob as unknown;
  if (value instanceof Blob && typeof value.arrayBuffer === 'function') {
    return value.arrayBuffer();
  }
  if (value instanceof ArrayBuffer || value instanceof Uint8Array || typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key]) =>
      /^\d+$/.test(key),
    );
    if (entries.length > 0 && entries.every(([, byte]) => typeof byte === 'number')) {
      return Uint8Array.from(
        entries
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([, byte]) => byte as number),
      );
    }
  }
  throw new Error(`Ресурс «${asset.filename}» невозможно упаковать в .vsalbum`);
}

function assetManifest(assets: AssetRecord[]): AlbumManifest['assets'] {
  return assets.map((asset) => ({
    id: asset.id,
    path: `assets/${asset.id}`,
    filename: asset.filename,
    mimeType: asset.mimeType,
    kind: asset.kind,
    byteSize: asset.byteSize,
    sourceAssetId: asset.sourceAssetId,
    metadata: asset.metadata,
  }));
}

function remapDocumentAssets(document: CanvasDocument, idMap: Map<string, string>): CanvasDocument {
  return {
    ...document,
    layers: document.layers.map(
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
    ),
  };
}

export const albumRepository = {
  async export(projectId: string): Promise<{ blob: Blob; filename: string }> {
    const [project, document, participants, participantPhotos, overrides, assets] =
      await Promise.all([
        database.projects.get(projectId),
        canvasSceneRepository.load(projectId),
        database.participants.where('projectId').equals(projectId).toArray(),
        database.participantPhotos.where('projectId').equals(projectId).toArray(),
        database.overrides.where('projectId').equals(projectId).toArray(),
        database.assets.where('projectId').equals(projectId).toArray(),
      ]);
    if (!project || !document) throw new Error('Проект не найден');
    const photosByParticipant = new Map<string, ParticipantPhotoRecord[]>();
    for (const photo of participantPhotos) {
      const list = photosByParticipant.get(photo.participantId) ?? [];
      list.push(photo);
      photosByParticipant.set(photo.participantId, list);
    }
    const manifest: AlbumManifest = albumManifestSchema.parse({
      format: 'vakha-album',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        schoolName: project.schoolName,
        className: project.className,
        academicYear: project.academicYear,
      },
      document,
      participants: {
        students: participants
          .filter((participant) => participant.type === 'student')
          .map((participant) =>
            toManifestParticipant(participant, photosByParticipant.get(participant.id) ?? []),
          ),
        teachers: participants
          .filter((participant) => participant.type === 'teacher')
          .map((participant) =>
            toManifestParticipant(participant, photosByParticipant.get(participant.id) ?? []),
          ),
      },
      overrides: overrides.map((override) => {
        const participant = participants.find((person) => person.id === override.participantId);
        return {
          participantExternalId: participant?.externalId ?? participant?.id,
          participantId: override.participantId,
          pageId: override.pageId,
          layerId: override.layerId,
          patch: override.patch,
        };
      }),
      assets: assetManifest(assets),
    });
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    for (const asset of assets) zip.file(`assets/${asset.id}`, await zipAssetData(asset));
    return {
      blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
      filename: `${safeName(project.name)}.vsalbum`,
    };
  },

  async import(file: File): Promise<string> {
    if (file.size <= 0 || file.size > MAX_ALBUM_BYTES)
      throw new Error('Размер альбома слишком большой');
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);
    if (entries.length > MAX_ALBUM_FILES) throw new Error('В альбоме слишком много файлов');
    for (const entry of entries) assertSafePath(entry.unsafeOriginalName ?? entry.name);
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) throw new Error('В альбоме отсутствует manifest.json');
    const manifest = albumManifestSchema.parse(JSON.parse(await manifestEntry.async('text')));
    const projectId = `album-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const idMap = new Map(manifest.assets.map((asset) => [asset.id, `${projectId}-${asset.id}`]));
    const assets: AssetRecord[] = [];
    for (const asset of manifest.assets) {
      const entry = zip.file(asset.path);
      if (!entry) throw new Error(`Ресурс «${asset.filename}» отсутствует`);
      const blob = await entry.async('blob');
      if (blob.size !== asset.byteSize)
        throw new Error(`Размер ресурса «${asset.filename}» не совпадает`);
      assets.push({
        id: idMap.get(asset.id)!,
        projectId,
        ownerType: 'project',
        kind: asset.kind,
        filename: asset.filename,
        mimeType: asset.mimeType,
        byteSize: blob.size,
        blob,
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
        createdAt: now,
      });
    }
    const project: ProjectRecord = {
      id: projectId,
      name: `${manifest.project.name} — импорт`,
      schoolName: manifest.project.schoolName,
      className: manifest.project.className,
      academicYear: manifest.project.academicYear,
      status: 'draft',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const participantEntries = [
      ...manifest.participants.students.map((person) => ({ person, type: 'student' as const })),
      ...manifest.participants.teachers.map((person) => ({ person, type: 'teacher' as const })),
    ].map(({ person, type }) => ({
      person,
      record: {
        id: `participant-${crypto.randomUUID()}`,
        projectId,
        type,
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        displayName: person.displayName,
        externalId: person.externalId,
        role: person.role,
        email: person.email,
        phone: person.phone,
        notes: person.notes,
        tags: person.tags,
        status: person.status,
        importBatchId: `album-import-${projectId}`,
        importedAt: now,
        updatedAt: now,
      } satisfies ParticipantRecord,
    }));
    const participantIdMap = new Map<string, string>();
    for (const { person, record } of participantEntries) {
      if (person.externalId) participantIdMap.set(person.externalId, record.id);
    }
    const participants = participantEntries.map((entry) => entry.record);
    const participantPhotos: ParticipantPhotoRecord[] = [];
    for (const { person, record } of participantEntries) {
      for (const photo of person.photos) {
        const sourceAssetId = assetIdFromManifestPath(photo.path);
        const assetId = idMap.get(sourceAssetId);
        if (!assetId) throw new Error(`Фото участника «${photo.path}» отсутствует в ресурсах`);
        participantPhotos.push({
          id: `participant-photo-${crypto.randomUUID()}`,
          projectId,
          participantId: record.id,
          assetId,
          role: photo.role,
          order: photo.order,
          sourcePath: photo.path,
        });
      }
    }
    const overrides: OverrideRecord[] = manifest.overrides.map((override) => ({
      id: `override-${crypto.randomUUID()}`,
      projectId,
      participantId:
        participantIdMap.get(override.participantExternalId ?? '') ??
        participantIdMap.get(override.participantId) ??
        override.participantId,
      pageId: override.pageId,
      layerId: override.layerId,
      patch: override.patch,
    }));
    await database.transaction(
      'rw',
      database.projects,
      database.assets,
      database.participants,
      database.participantPhotos,
      database.overrides,
      async () => {
        await database.projects.put(project);
        if (assets.length > 0) await database.assets.bulkPut(assets);
        if (participants.length > 0) await database.participants.bulkPut(participants);
        if (participantPhotos.length > 0)
          await database.participantPhotos.bulkPut(participantPhotos);
        if (overrides.length > 0) await database.overrides.bulkPut(overrides);
      },
    );
    await canvasSceneRepository.save({
      ...remapDocumentAssets(manifest.document, idMap),
      projectId,
      updatedAt: now,
    });
    return projectId;
  },
};
