import {
  applySnapshotToFabricObject,
  createFabricObject,
  fabricObjectToSnapshot,
} from './layer-object.factory';
import type { CanvasObjectSnapshot } from '../model/canvas-document';

const fixture: CanvasObjectSnapshot = {
  id: 'object-1',
  name: 'Тестовый объект',
  kind: 'rect',
  xMm: 12.5,
  yMm: 24,
  widthMm: 60,
  heightMm: 40,
  rotationDeg: 8,
  fill: '#7657e8',
  stroke: '#ffffff',
  strokeWidthMm: 0.5,
  opacity: 0.8,
};

describe('layer object factory', () => {
  it('выполняет детерминированный round-trip собственной модели', () => {
    const object = createFabricObject(fixture);

    expect(fabricObjectToSnapshot(object)).toEqual(fixture);
  });

  it('применяет snapshot без накопления масштаба', () => {
    const object = createFabricObject(fixture);
    object.set({ scaleX: 1.5, scaleY: 1.2 });
    const changed = fabricObjectToSnapshot(object);

    applySnapshotToFabricObject(object, changed);
    expect(object.scaleX).toBe(1);
    expect(object.scaleY).toBe(1);
    expect(fabricObjectToSnapshot(object)).toEqual(changed);
  });
});
