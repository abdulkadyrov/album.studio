import {
  canvasDocumentSchema,
  canvasLayerSchema,
  canvasPageSchema,
  createDefaultCanvasDocument,
  normalizeDocumentOrder,
  type CanvasDocument,
  type CanvasLayerSnapshot,
} from '../../canvas/model/canvas-document';
import { database } from '../db/database';

function migrateLegacyScene(
  projectId: string,
  pagePayload: Record<string, unknown>,
  layerPayloads: Record<string, unknown>[],
): CanvasDocument {
  const migrated = createDefaultCanvasDocument(projectId);
  const widthMm = typeof pagePayload.widthMm === 'number' ? pagePayload.widthMm : 200;
  const heightMm = typeof pagePayload.heightMm === 'number' ? pagePayload.heightMm : 200;
  const bleedMm = typeof pagePayload.bleedMm === 'number' ? pagePayload.bleedMm : 3;
  const safeZoneMm = typeof pagePayload.safeZoneMm === 'number' ? pagePayload.safeZoneMm : 5;
  const gridStepMm = typeof pagePayload.gridStepMm === 'number' ? pagePayload.gridStepMm : 5;
  migrated.pages = migrated.pages.map((page) => ({
    ...page,
    widthMm,
    heightMm,
    bleedMm,
    safeZoneMm,
    gridStepMm,
  }));

  const layers = layerPayloads.flatMap((payload, index) => {
    const xMm = typeof payload.xMm === 'number' ? payload.xMm : 0;
    const isRightPage = xMm >= widthMm;
    const candidate = {
      ...payload,
      pageId: migrated.pages[isRightPage ? 1 : 0]!.id,
      xMm: isRightPage ? xMm - widthMm : xMm,
      visible: true,
      locked: false,
      zIndex: index,
    };
    const result = canvasLayerSchema.safeParse(candidate);
    return result.success ? [result.data] : [];
  });
  if (layers.length > 0) migrated.layers = layers;
  migrated.updatedAt =
    typeof pagePayload.updatedAt === 'string' ? pagePayload.updatedAt : new Date().toISOString();
  return migrated;
}

export const canvasSceneRepository = {
  async load(projectId: string): Promise<CanvasDocument | undefined> {
    const pageRecords = await database.pages.where('projectId').equals(projectId).sortBy('order');
    if (pageRecords.length === 0) return undefined;

    const layerRecords = await database.layers.where('projectId').equals(projectId).toArray();
    const legacyPage = pageRecords.find((page) => page.type === 'canvas-spread');
    if (legacyPage) {
      return migrateLegacyScene(
        projectId,
        legacyPage.payload,
        layerRecords.map((layer) => layer.payload),
      );
    }

    const pages = pageRecords.flatMap((record) => {
      if (record.type !== 'canvas-page') return [];
      const result = canvasPageSchema.safeParse(record.payload);
      return result.success ? [result.data] : [];
    });
    const layers = layerRecords.flatMap((record) => {
      const result = canvasLayerSchema.safeParse(record.payload);
      return result.success ? [result.data] : [];
    });
    const updatedAt = pageRecords.reduce((latest, page) => {
      const value = page.payload.updatedAt;
      return typeof value === 'string' && value > latest ? value : latest;
    }, new Date(0).toISOString());
    const result = canvasDocumentSchema.safeParse({
      version: 2,
      projectId,
      pages,
      layers,
      updatedAt,
    });
    return result.success ? normalizeDocumentOrder(result.data) : undefined;
  },

  async save(document: CanvasDocument): Promise<void> {
    const validDocument = normalizeDocumentOrder(canvasDocumentSchema.parse(document));
    const newPageIds = new Set(validDocument.pages.map((page) => page.id));
    const newLayerIds = new Set(validDocument.layers.map((layer) => layer.id));

    await database.transaction('rw', database.pages, database.layers, async () => {
      const existingPages = await database.pages
        .where('projectId')
        .equals(document.projectId)
        .toArray();
      const stalePageIds = existingPages
        .filter((page) => page.type === 'canvas-page' || page.type === 'canvas-spread')
        .map((page) => page.id)
        .filter((id) => !newPageIds.has(id));
      if (stalePageIds.length > 0) await database.pages.bulkDelete(stalePageIds);

      const existingLayers = await database.layers
        .where('projectId')
        .equals(document.projectId)
        .toArray();
      const staleLayerIds = existingLayers
        .map((layer) => layer.id)
        .filter((id) => !newLayerIds.has(id));
      if (staleLayerIds.length > 0) await database.layers.bulkDelete(staleLayerIds);

      await database.pages.bulkPut(
        validDocument.pages.map((page) => ({
          id: page.id,
          projectId: document.projectId,
          order: page.order,
          type: 'canvas-page',
          payload: { ...page, updatedAt: validDocument.updatedAt },
        })),
      );
      await database.layers.bulkPut(
        validDocument.layers.map((layer: CanvasLayerSnapshot) => ({
          id: layer.id,
          projectId: document.projectId,
          pageId: layer.pageId,
          parentId: layer.parentId,
          type: layer.kind,
          zIndex: layer.zIndex,
          payload: layer,
        })),
      );
    });
  },
};
