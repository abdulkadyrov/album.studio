import { Line, Rect } from 'fabric';

import { createDefaultCanvasDocument } from '../model/canvas-document';
import { createGridDecorations, createPageDecorations } from './scene-decorations';

describe('scene decorations', () => {
  const page = createDefaultCanvasDocument('geometry-test').page;

  it('строит полный разворот из двух страниц 200 × 200 мм', () => {
    const decorations = createPageDecorations(page);
    const pageBackgrounds = decorations.filter(
      (object): object is Rect => object instanceof Rect && object.fill !== 'transparent',
    );

    expect(pageBackgrounds).toHaveLength(2);
    expect(pageBackgrounds[0]).toMatchObject({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      width: 600,
      height: 600,
    });
    expect(pageBackgrounds[1]).toMatchObject({
      left: 600,
      top: 0,
      originX: 'left',
      originY: 'top',
      width: 600,
      height: 600,
    });
  });

  it('ограничивает линии сетки габаритами разворота', () => {
    const grid = createGridDecorations(page);
    const horizontalLines = grid.filter(
      (object): object is Line => object instanceof Line && object.y1 === object.y2,
    );

    expect(horizontalLines).toHaveLength(39);
    expect(horizontalLines.every((line) => line.x1 === 0 && line.x2 === 1200)).toBe(true);
    expect(horizontalLines.at(-1)?.y1).toBe(585);
  });
});
