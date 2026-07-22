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
      widthMm: restored.widthMm,
      heightMm: restored.heightMm,
      text: textLayer.text,
    });
    expect(restored.widthMm).toBeLessThan(textLayer.widthMm);
    expect(restored.heightMm).toBeLessThan(textLayer.heightMm);
  });

  it('сужает auto-текст до видимой строки и использует реальные пиксели для фигур', () => {
    const text = createFabricObject({
      ...fixture,
      id: 'text-hitbox',
      kind: 'text',
      widthMm: 120,
      heightMm: 40,
      text: createDefaultTextStyle(),
    });
    const circle = createFabricObject({ ...fixture, id: 'circle-hitbox', kind: 'circle' });

    expect(text.perPixelTargetFind).toBe(false);
    expect(fabricObjectToSnapshot(text).widthMm).toBeLessThan(120);
    expect(circle.perPixelTargetFind).toBe(true);
    expect(text.targetFindTolerance).toBe(0);
    expect(circle.targetFindTolerance).toBe(0);
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

  it('показывает пустую фоторамку как кликабельный плейсхолдер без изменения модели', () => {
    const imageLayer: CanvasObjectSnapshot = {
      ...fixture,
      id: 'empty-frame',
      kind: 'frame',
      fill: 'transparent',
      image: createDefaultImageStyle({
        assetId: 'missing-image',
        filename: 'Выберите фото',
        mimeType: 'image/png',
        naturalWidthPx: 1200,
        naturalHeightPx: 1600,
      }),
    };

    const object = createFabricObject(imageLayer);

    expect(object.fill).toBe('transparent');
    expect(object.stroke).toBe('#ffffff');
    expect(object.hoverCursor).toBe('pointer');
    expect(fabricObjectToSnapshot(object)).toMatchObject(imageLayer);
  });
});
