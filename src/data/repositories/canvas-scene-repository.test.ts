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
    document.objects[0]!.xMm = 73.5;

    await canvasSceneRepository.save(document);
    const restored = await canvasSceneRepository.load('canvas-project');

    expect(restored?.objects[0]?.xMm).toBe(73.5);
    expect(await database.layers.where('projectId').equals('canvas-project').count()).toBe(2);
  });
});
