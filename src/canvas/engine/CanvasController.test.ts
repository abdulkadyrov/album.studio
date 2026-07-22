import { vi } from 'vitest';

import {
  createDefaultCanvasDocument,
  createDefaultImageStyle,
  type CanvasDocument,
} from '../model/canvas-document';
import { CanvasController } from './CanvasController';

type TestFabricCanvas = {
  _currentTransform?: unknown;
  endCurrentTransform: (event: Event) => void;
  fire: (eventName: string, payload: unknown) => void;
  getObjects: () => Array<{ vakhaId?: string }>;
};

describe('CanvasController', () => {
  function createController(
    documentModel: CanvasDocument = createDefaultCanvasDocument('sticky-pointer-test'),
    onFrameReplaceRequest = vi.fn(),
  ) {
    const element = document.createElement('canvas');
    document.body.append(element);
    const controller = new CanvasController(element, {
      document: documentModel,
      activePageId: documentModel.pages[0]!.id,
      onDocumentChange: vi.fn(),
      onStateChange: vi.fn(),
      onFrameReplaceRequest,
    });
    const fabricCanvas = (controller as unknown as { canvas: TestFabricCanvas }).canvas;
    return { controller, element, fabricCanvas, onFrameReplaceRequest };
  }

  it('отпускает активную трансформацию, если кнопка мыши уже не нажата', async () => {
    const { controller, element, fabricCanvas } = createController();
    const endCurrentTransform = vi.fn((event: Event) => {
      expect(event.type).toBe('mousemove');
      fabricCanvas._currentTransform = undefined;
    });
    fabricCanvas._currentTransform = { action: 'drag' };
    fabricCanvas.endCurrentTransform = endCurrentTransform;

    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 0 }));

    expect(endCurrentTransform).toHaveBeenCalledOnce();
    expect(fabricCanvas._currentTransform).toBeUndefined();
    await controller.dispose();
    element.remove();
  });

  it('сбрасывает зависшую трансформацию при смене инструмента', async () => {
    const { controller, element, fabricCanvas } = createController();
    const endCurrentTransform = vi.fn((event: Event) => {
      expect(event.type).toBe('toolchange');
      fabricCanvas._currentTransform = undefined;
    });
    fabricCanvas._currentTransform = { action: 'drag' };
    fabricCanvas.endCurrentTransform = endCurrentTransform;

    controller.setTool('pan');

    expect(endCurrentTransform).toHaveBeenCalledOnce();
    expect(fabricCanvas._currentTransform).toBeUndefined();
    await controller.dispose();
    element.remove();
  });

  it('запрашивает выбор фото по двойному клику на фоторамке', async () => {
    const documentModel = createDefaultCanvasDocument('frame-dblclick-test');
    const pageId = documentModel.pages[0]!.id;
    documentModel.layers.push({
      id: 'frame-dblclick-test:frame-empty',
      pageId,
      name: 'Плейсхолдер фото',
      kind: 'frame',
      visible: true,
      locked: false,
      zIndex: 2,
      xMm: 20,
      yMm: 20,
      widthMm: 60,
      heightMm: 80,
      rotationDeg: 0,
      fill: '#c9c9c9',
      stroke: '#0b8fff',
      strokeWidthMm: 0.5,
      opacity: 1,
      image: createDefaultImageStyle({
        assetId: 'missing-photo',
        filename: 'Выберите фото',
        mimeType: 'image/png',
        naturalWidthPx: 1200,
        naturalHeightPx: 1600,
      }),
    });
    const { controller, element, fabricCanvas, onFrameReplaceRequest } =
      createController(documentModel);
    const target = fabricCanvas
      .getObjects()
      .find((object) => object.vakhaId === 'frame-dblclick-test:frame-empty');

    fabricCanvas.fire('mouse:dblclick', { target });

    expect(onFrameReplaceRequest).toHaveBeenCalledWith('frame-dblclick-test:frame-empty');
    await controller.dispose();
    element.remove();
  });
});
