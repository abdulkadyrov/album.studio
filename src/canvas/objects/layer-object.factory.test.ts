import {
  applySnapshotToFabricObject,
  createFabricObject,
  fabricObjectToSnapshot,
} from './layer-object.factory';
import {
  createDefaultImageStyle,
  createDefaultTextStyle,
  type CanvasObjectSnapshot,
} from '../model/canvas-document';

const fixture: CanvasObjectSnapshot = {
  id: 'object-1',
  pageId: 'page-1',
  name: 'Тестовый объект',
  kind: 'rect',
  visible: true,
  locked: false,
  zIndex: 0,
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

  it('сохраняет исходный текст и параметры текстовой области', () => {
    const textLayer: CanvasObjectSnapshot = {
      ...fixture,
      id: 'text-1',
      kind: 'text',
      name: 'Заголовок',
      widthMm: 100,
      heightMm: 30,
      fill: '#222222',
      text: {
        ...createDefaultTextStyle(),
        content: 'наш дружный класс',
        textCase: 'upper',
        textAlign: 'center',
      },
    };

    const object = createFabricObject(textLayer);
    const restored = fabricObjectToSnapshot(object);

    expect(object.get('text')).toBe('НАШ ДРУЖНЫЙ КЛАСС');
    expect(restored).toMatchObject({
      ...textLayer,
      heightMm: restored.heightMm,
      text: textLayer.text,
    });
    expect(restored.heightMm).toBeLessThan(textLayer.heightMm);
  });

  it('сохраняет параметры изображения даже без доступного локального оригинала', () => {
    const imageLayer: CanvasObjectSnapshot = {
      ...fixture,
      id: 'image-1',
      kind: 'frame',
      image: {
        ...createDefaultImageStyle({
          assetId: 'missing-image',
          filename: 'portrait.webp',
          mimeType: 'image/webp',
          naturalWidthPx: 1200,
          naturalHeightPx: 1600,
        }),
        frameShape: 'circle',
        cropX: 0.3,
        zoom: 1.4,
      },
    };

    const restored = fabricObjectToSnapshot(createFabricObject(imageLayer));
    expect(restored).toMatchObject(imageLayer);
    expect(restored.image).toEqual(imageLayer.image);
  });
});
