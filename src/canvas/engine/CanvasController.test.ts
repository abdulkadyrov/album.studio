import { vi } from 'vitest';

import { createDefaultCanvasDocument } from '../model/canvas-document';
import { CanvasController } from './CanvasController';

type TestFabricCanvas = {
  _currentTransform?: unknown;
  endCurrentTransform: (event: Event) => void;
};

describe('CanvasController', () => {
  function createController() {
    const documentModel = createDefaultCanvasDocument('sticky-pointer-test');
    const element = document.createElement('canvas');
    document.body.append(element);
    const controller = new CanvasController(element, {
      document: documentModel,
      activePageId: documentModel.pages[0]!.id,
      onDocumentChange: vi.fn(),
      onStateChange: vi.fn(),
    });
    const fabricCanvas = (controller as unknown as { canvas: TestFabricCanvas }).canvas;
    return { controller, element, fabricCanvas };
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
});
