import Dexie, { type EntityTable } from 'dexie';

import type {
  AppSettingRecord,
  AssetRecord,
  ExportHistoryRecord,
  LayerRecord,
  OverrideRecord,
  PageRecord,
  ParticipantPhotoRecord,
  ParticipantRecord,
  ProjectRecord,
  TemplateRecord,
  WorkspaceRecord,
} from './schema';

class VakhaDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  pages!: EntityTable<PageRecord, 'id'>;
  layers!: EntityTable<LayerRecord, 'id'>;
  assets!: EntityTable<AssetRecord, 'id'>;
  templates!: EntityTable<TemplateRecord, 'id'>;
  participants!: EntityTable<ParticipantRecord, 'id'>;
  participantPhotos!: EntityTable<ParticipantPhotoRecord, 'id'>;
  overrides!: EntityTable<OverrideRecord, 'id'>;
  references!: EntityTable<WorkspaceRecord, 'id'>;
  ideas!: EntityTable<WorkspaceRecord, 'id'>;
  annotations!: EntityTable<WorkspaceRecord, 'id'>;
  settings!: EntityTable<AppSettingRecord, 'key'>;
  exportHistory!: EntityTable<ExportHistoryRecord, 'id'>;

  constructor() {
    super('vakha-album-designer');

    this.version(1).stores({
      projects: '&id, updatedAt, name, status',
      pages: '&id, projectId, [projectId+order]',
      layers: '&id, pageId, projectId, [pageId+zIndex], parentId, type',
      assets: '&id, projectId, ownerType, kind, hash, sourceAssetId',
      templates: '&id, category, style, favorite, updatedAt',
      participants: '&id, projectId, [projectId+type], status, lastName',
      participantPhotos: '&id, participantId, projectId, assetId',
      overrides: '&id, [participantId+pageId], layerId, projectId',
      references: '&id, projectId, favorite, category, updatedAt',
      ideas: '&id, projectId, status, updatedAt',
      annotations: '&id, projectId, pageId, layerId, participantId, status',
      settings: '&key',
      exportHistory: '&id, projectId, createdAt, status',
    });
  }
}

export const database = new VakhaDatabase();
