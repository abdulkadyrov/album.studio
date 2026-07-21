export interface ProjectRecord {
  id: string;
  name: string;
  schoolName: string;
  className: string;
  academicYear: string;
  status: 'draft' | 'ready' | 'archived';
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageRecord {
  id: string;
  projectId: string;
  order: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface LayerRecord {
  id: string;
  projectId: string;
  pageId: string;
  parentId?: string;
  type: string;
  zIndex: number;
  payload: Record<string, unknown>;
}

export interface AssetRecord {
  id: string;
  projectId?: string;
  ownerType: 'project' | 'template' | 'system' | 'user';
  kind: 'image' | 'thumbnail' | 'font' | 'svg' | 'decoration';
  filename: string;
  mimeType: string;
  byteSize: number;
  blob: Blob;
  hash?: string;
  sourceAssetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  category: string;
  style: string;
  favorite: 0 | 1;
  updatedAt: string;
  payload: Record<string, unknown>;
}

export interface ParticipantRecord {
  id: string;
  projectId: string;
  type: 'student' | 'teacher';
  firstName: string;
  lastName: string;
  status: string;
  updatedAt: string;
}

export interface ParticipantPhotoRecord {
  id: string;
  projectId: string;
  participantId: string;
  assetId: string;
  role: 'main' | 'additional';
  order: number;
}

export interface OverrideRecord {
  id: string;
  projectId: string;
  participantId: string;
  pageId: string;
  layerId: string;
  patch: Record<string, unknown>;
}

export interface WorkspaceRecord {
  id: string;
  projectId: string;
  pageId?: string;
  layerId?: string;
  participantId?: string;
  status?: string;
  category?: string;
  favorite?: 0 | 1;
  updatedAt: string;
  payload: Record<string, unknown>;
}

export interface AppSettingRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface ExportHistoryRecord {
  id: string;
  projectId: string;
  status: 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  payload: Record<string, unknown>;
}
