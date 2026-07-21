import { createDefaultCanvasDocument } from '../../canvas/model/canvas-document';
import { database } from '../db/database';
import { canvasSceneRepository } from './canvas-scene-repository';

describe('canvasSceneRepository', () => {
  beforeEach(async () => {
    database.close();
    await database.delete();
    await database.open();
  });

  afterEach(() => {
    database.close();
  });

  it('сохраняет и восстанавливает нормализованную сцену', async () => {
    const document = createDefaultCanvasDocument('canvas-project');
    document.layers[0]!.xMm = 73.5;

    await canvasSceneRepository.save(document);
    const restored = await canvasSceneRepository.load('canvas-project');

    expect(
      restored?.layers.find((layer) => layer.id === 'canvas-project:object-geometry')?.xMm,
    ).toBe(73.5);
    expect(restored?.pages).toHaveLength(2);
    expect(await database.layers.where('projectId').equals('canvas-project').count()).toBe(2);
  });

  it('мигрирует локальную сцену этапа 2 без потери геометрии', async () => {
    await database.pages.put({
      id: 'legacy:spread-main',
      projectId: 'legacy',
      order: 0,
      type: 'canvas-spread',
      payload: {
        id: 'legacy:spread-main',
        widthMm: 200,
        heightMm: 200,
        spread: true,
        bleedMm: 3,
        safeZoneMm: 5,
        gridStepMm: 5,
        updatedAt: new Date().toISOString(),
      },
    });
    await database.layers.put({
      id: 'legacy:canvas:old-object',
      projectId: 'legacy',
      pageId: 'legacy:spread-main',
      type: 'rect',
      zIndex: 0,
      payload: {
        id: 'old-object',
        name: 'Слой этапа 2',
        kind: 'rect',
        xMm: 245,
        yMm: 20,
        widthMm: 30,
        heightMm: 40,
        rotationDeg: 0,
        fill: '#7657e8',
        stroke: '#ffffff',
        strokeWidthMm: 0,
        opacity: 1,
      },
    });

    const migrated = await canvasSceneRepository.load('legacy');

    expect(migrated?.version).toBe(2);
    expect(migrated?.pages).toHaveLength(2);
    expect(migrated?.layers[0]).toMatchObject({
      name: 'Слой этапа 2',
      pageId: migrated.pages[1]?.id,
      xMm: 45,
    });
  });
});
