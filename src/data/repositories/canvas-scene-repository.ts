import {
  canvasDocumentSchema,
  type CanvasDocument,
  type CanvasObjectSnapshot,
} from '../../canvas/model/canvas-document';
import { database } from '../db/database';

function layerId(projectId: string, objectId: string): string {
  return `${projectId}:canvas:${objectId}`;
}

export const canvasSceneRepository = {
  async load(projectId: string): Promise<CanvasDocument | undefined> {
    const page = await database.pages.where('projectId').equals(projectId).first();
    if (!page || page.type !== 'canvas-spread') return undefined;

    const layers = await database.layers.where('pageId').equals(page.id).sortBy('zIndex');
    const candidate = {
      version: 1,
      projectId,
      page: page.payload,
      objects: layers.map((layer) => layer.payload),
      updatedAt: (page.payload.updatedAt as string | undefined) ?? new Date(0).toISOString(),
    };

    const result = canvasDocumentSchema.safeParse(candidate);
    return result.success ? result.data : undefined;
  },

  async save(document: CanvasDocument): Promise<void> {
    const validDocument = canvasDocumentSchema.parse(document);
    const pageId = validDocument.page.id;
    const newLayerIds = new Set(
      validDocument.objects.map((object) => layerId(document.projectId, object.id)),
    );

    await database.transaction('rw', database.pages, database.layers, async () => {
      await database.pages.put({
        id: pageId,
        projectId: document.projectId,
        order: 0,
        type: 'canvas-spread',
        payload: { ...validDocument.page, updatedAt: validDocument.updatedAt },
      });

      const existingLayers = await database.layers.where('pageId').equals(pageId).toArray();
      const staleLayerIds = existingLayers
        .map((layer) => layer.id)
        .filter((id) => !newLayerIds.has(id));
      if (staleLayerIds.length > 0) await database.layers.bulkDelete(staleLayerIds);

      await database.layers.bulkPut(
        validDocument.objects.map((object: CanvasObjectSnapshot, index) => ({
          id: layerId(document.projectId, object.id),
          projectId: document.projectId,
          pageId,
          type: object.kind,
          zIndex: index,
          payload: object,
        })),
      );
    });
  },
};
