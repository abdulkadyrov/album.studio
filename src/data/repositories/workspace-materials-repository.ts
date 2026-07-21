import type { CanvasDocument } from '../../canvas/model/canvas-document';
import { database } from '../db/database';
import type { WorkspaceRecord } from '../db/schema';
import { canvasSceneRepository } from './canvas-scene-repository';
import { participantRepository } from './participant-repository';

export type MaterialKind = 'reference' | 'idea' | 'annotation';
export type ReferenceStatus = 'active' | 'archived';
export type IdeaStatus = 'draft' | 'selected' | 'archived';
export type AnnotationStatus = 'open' | 'resolved' | 'archived';
export type AnnotationKind = 'point' | 'area' | 'layer' | 'participant';

export interface ReferencePayload {
  title: string;
  url?: string;
  notes: string;
  tags: string[];
  sourceType: 'image' | 'site' | 'text' | 'other';
}

export interface IdeaPayload {
  title: string;
  description: string;
  tags: string[];
  priority: 'low' | 'normal' | 'high';
}

export interface AnnotationPayload {
  title: string;
  body: string;
  kind: AnnotationKind;
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;
  tags: string[];
}

export interface WorkspaceMaterial<TPayload> {
  id: string;
  projectId: string;
  pageId?: string;
  layerId?: string;
  participantId?: string;
  status?: string;
  category?: string;
  favorite: boolean;
  updatedAt: string;
  payload: TPayload;
}

export interface WorkspaceFilters {
  query?: string;
  status?: string;
  category?: string;
  pageId?: string;
}

export interface SaveReferenceInput {
  title: string;
  url?: string;
  notes?: string;
  tags?: string[];
  sourceType?: ReferencePayload['sourceType'];
  category?: string;
  pageId?: string;
  layerId?: string;
  status?: ReferenceStatus;
  favorite?: boolean;
}

export interface SaveIdeaInput {
  title: string;
  description?: string;
  tags?: string[];
  priority?: IdeaPayload['priority'];
  category?: string;
  pageId?: string;
  layerId?: string;
  status?: IdeaStatus;
  favorite?: boolean;
}

export interface SaveAnnotationInput {
  title: string;
  body?: string;
  kind?: AnnotationKind;
  tags?: string[];
  pageId?: string;
  layerId?: string;
  participantId?: string;
  status?: AnnotationStatus;
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;
}

function tagsFrom(value?: string[] | string): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function table(kind: MaterialKind) {
  if (kind === 'reference') return database.references;
  if (kind === 'idea') return database.ideas;
  return database.annotations;
}

function parseMaterial<TPayload>(record: WorkspaceRecord): WorkspaceMaterial<TPayload> {
  return {
    id: record.id,
    projectId: record.projectId,
    pageId: record.pageId,
    layerId: record.layerId,
    participantId: record.participantId,
    status: record.status,
    category: record.category,
    favorite: record.favorite === 1,
    updatedAt: record.updatedAt,
    payload: record.payload as TPayload,
  };
}

function textForSearch(material: WorkspaceMaterial<unknown>): string {
  return JSON.stringify({
    status: material.status,
    category: material.category,
    payload: material.payload,
  }).toLocaleLowerCase('ru');
}

function filterMaterials<TPayload>(
  materials: WorkspaceMaterial<TPayload>[],
  filters: WorkspaceFilters = {},
): WorkspaceMaterial<TPayload>[] {
  const query = filters.query?.trim().toLocaleLowerCase('ru') ?? '';
  return materials.filter((material) => {
    const generic = material as WorkspaceMaterial<unknown>;
    return (
      (!query || textForSearch(generic).includes(query)) &&
      (!filters.status || filters.status === 'all' || material.status === filters.status) &&
      (!filters.category || filters.category === 'all' || material.category === filters.category) &&
      (!filters.pageId || filters.pageId === 'all' || material.pageId === filters.pageId)
    );
  });
}

function cleanLinkId(value?: string): string | undefined {
  return value && value !== 'none' && value !== 'all' ? value : undefined;
}

async function materialList<TPayload>(
  kind: MaterialKind,
  projectId: string,
  filters?: WorkspaceFilters,
): Promise<WorkspaceMaterial<TPayload>[]> {
  const records = await table(kind).where('projectId').equals(projectId).toArray();
  return filterMaterials(
    records
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(parseMaterial<TPayload>),
    filters,
  );
}

export const workspaceMaterialsRepository = {
  async listReferences(
    projectId: string,
    filters?: WorkspaceFilters,
  ): Promise<WorkspaceMaterial<ReferencePayload>[]> {
    return materialList('reference', projectId, filters);
  },

  async saveReference(projectId: string, input: SaveReferenceInput, id?: string): Promise<string> {
    const materialId = id ?? `reference-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const existing = id ? await database.references.get(id) : undefined;
    await database.references.put({
      id: materialId,
      projectId,
      pageId: cleanLinkId(input.pageId),
      layerId: cleanLinkId(input.layerId),
      status: input.status ?? existing?.status ?? 'active',
      category: input.category?.trim() || 'general',
      favorite: (input.favorite ?? existing?.favorite === 1) ? 1 : 0,
      updatedAt: now,
      payload: {
        title: input.title.trim(),
        url: input.url?.trim() || undefined,
        notes: input.notes?.trim() ?? '',
        tags: tagsFrom(input.tags),
        sourceType: input.sourceType ?? 'other',
      } satisfies ReferencePayload,
    });
    return materialId;
  },

  async deleteReference(id: string): Promise<void> {
    await database.references.delete(id);
  },

  async listIdeas(
    projectId: string,
    filters?: WorkspaceFilters,
  ): Promise<WorkspaceMaterial<IdeaPayload>[]> {
    return materialList('idea', projectId, filters);
  },

  async saveIdea(projectId: string, input: SaveIdeaInput, id?: string): Promise<string> {
    const materialId = id ?? `idea-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const existing = id ? await database.ideas.get(id) : undefined;
    await database.ideas.put({
      id: materialId,
      projectId,
      pageId: cleanLinkId(input.pageId),
      layerId: cleanLinkId(input.layerId),
      status: input.status ?? existing?.status ?? 'draft',
      category: input.category?.trim() || 'layout',
      favorite: (input.favorite ?? existing?.favorite === 1) ? 1 : 0,
      updatedAt: now,
      payload: {
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        tags: tagsFrom(input.tags),
        priority: input.priority ?? 'normal',
      } satisfies IdeaPayload,
    });
    return materialId;
  },

  async deleteIdea(id: string): Promise<void> {
    await database.ideas.delete(id);
  },

  async listAnnotations(
    projectId: string,
    filters?: WorkspaceFilters,
  ): Promise<WorkspaceMaterial<AnnotationPayload>[]> {
    return materialList('annotation', projectId, filters);
  },

  async saveAnnotation(
    projectId: string,
    input: SaveAnnotationInput,
    id?: string,
  ): Promise<string> {
    const materialId = id ?? `annotation-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const existing = id ? await database.annotations.get(id) : undefined;
    await database.annotations.put({
      id: materialId,
      projectId,
      pageId: cleanLinkId(input.pageId),
      layerId: cleanLinkId(input.layerId),
      participantId: cleanLinkId(input.participantId),
      status: input.status ?? existing?.status ?? 'open',
      category: input.kind ?? existing?.category ?? 'point',
      favorite: 0,
      updatedAt: now,
      payload: {
        title: input.title.trim(),
        body: input.body?.trim() ?? '',
        kind: input.kind ?? 'point',
        xMm: input.xMm,
        yMm: input.yMm,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        tags: tagsFrom(input.tags),
      } satisfies AnnotationPayload,
    });
    return materialId;
  },

  async updateAnnotationStatus(id: string, status: AnnotationStatus): Promise<void> {
    await database.annotations.update(id, { status, updatedAt: new Date().toISOString() });
  },

  async deleteAnnotation(id: string): Promise<void> {
    await database.annotations.delete(id);
  },

  async exportAnnotations(projectId: string, format: 'json' | 'markdown'): Promise<Blob> {
    const [annotations, document, participants] = await Promise.all([
      workspaceMaterialsRepository.listAnnotations(projectId),
      canvasSceneRepository.load(projectId),
      participantRepository.list(projectId),
    ]);
    if (format === 'json') {
      return new Blob(
        [JSON.stringify({ format: 'vakha-annotations', version: 1, annotations }, null, 2)],
        {
          type: 'application/json',
        },
      );
    }
    return new Blob([annotationsToMarkdown(annotations, document, participants)], {
      type: 'text/markdown',
    });
  },
};

function linkedName(id: string | undefined, lookup: Map<string, string>, fallback: string): string {
  return id ? (lookup.get(id) ?? id) : fallback;
}

function annotationsToMarkdown(
  annotations: WorkspaceMaterial<AnnotationPayload>[],
  document?: CanvasDocument,
  participants: Array<{
    id: string;
    displayName?: string;
    firstName: string;
    lastName: string;
  }> = [],
): string {
  const pageNames = new Map(document?.pages.map((page) => [page.id, page.title]) ?? []);
  const layerNames = new Map(document?.layers.map((layer) => [layer.id, layer.name]) ?? []);
  const participantNames = new Map(
    participants.map((person) => [
      person.id,
      person.displayName || [person.lastName, person.firstName].filter(Boolean).join(' '),
    ]),
  );
  const lines = ['# Аннотации проекта', ''];
  for (const annotation of annotations) {
    lines.push(`## ${annotation.payload.title}`);
    lines.push('');
    lines.push(`- Статус: ${annotation.status ?? 'open'}`);
    lines.push(`- Тип: ${annotation.payload.kind}`);
    lines.push(`- Страница: ${linkedName(annotation.pageId, pageNames, 'не привязана')}`);
    lines.push(`- Слой: ${linkedName(annotation.layerId, layerNames, 'не привязан')}`);
    lines.push(
      `- Участник: ${linkedName(annotation.participantId, participantNames, 'не привязан')}`,
    );
    if (annotation.payload.tags.length > 0)
      lines.push(`- Теги: ${annotation.payload.tags.join(', ')}`);
    if (annotation.payload.body) {
      lines.push('');
      lines.push(annotation.payload.body);
    }
    lines.push('');
  }
  return lines.join('\n');
}
