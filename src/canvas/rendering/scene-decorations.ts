import { Line, Rect, type FabricObject } from 'fabric';

import { getSpreadWidthMm, type CanvasPageLayout } from '../model/canvas-document';
import { millimetersToLogicalPixels } from '../../utils/dimensions';
import type { VakhaFabricObject } from '../objects/layer-object.factory';

function markDecoration<T extends FabricObject>(object: T): T {
  const decoration = object as VakhaFabricObject;
  decoration.vakhaRole = 'decoration';
  object.set({ selectable: false, evented: false, excludeFromExport: true, objectCaching: false });
  return object;
}

export function createPageDecorations(page: CanvasPageLayout): FabricObject[] {
  const pageWidth = millimetersToLogicalPixels(page.widthMm);
  const pageHeight = millimetersToLogicalPixels(page.heightMm);
  const safeInset = millimetersToLogicalPixels(page.safeZoneMm);
  const decorations: FabricObject[] = [];
  const pageCount = page.spread ? 2 : 1;

  for (let index = 0; index < pageCount; index += 1) {
    const left = index * pageWidth;
    decorations.push(
      markDecoration(
        new Rect({
          left,
          top: 0,
          originX: 'left',
          originY: 'top',
          width: pageWidth,
          height: pageHeight,
          fill: index === 0 ? '#efebe4' : '#e7e4de',
          stroke: '#ffffff',
          strokeWidth: 1,
          shadow: { color: 'rgba(0,0,0,.34)', blur: 30, offsetX: 0, offsetY: 18 },
        }),
      ),
      markDecoration(
        new Rect({
          left: left + safeInset,
          top: safeInset,
          originX: 'left',
          originY: 'top',
          width: pageWidth - safeInset * 2,
          height: pageHeight - safeInset * 2,
          fill: 'transparent',
          stroke: 'rgba(66,74,88,.24)',
          strokeWidth: 1,
          strokeDashArray: [7, 6],
        }),
      ),
    );
  }

  if (page.spread) {
    decorations.push(
      markDecoration(
        new Line([pageWidth, 0, pageWidth, pageHeight], {
          stroke: 'rgba(39,44,54,.26)',
          strokeWidth: 1.2,
        }),
      ),
    );
  }

  return decorations;
}

export function createGridDecorations(page: CanvasPageLayout): FabricObject[] {
  const spreadWidth = millimetersToLogicalPixels(getSpreadWidthMm(page));
  const pageHeight = millimetersToLogicalPixels(page.heightMm);
  const step = millimetersToLogicalPixels(page.gridStepMm);
  const decorations: FabricObject[] = [];

  for (let x = step; x < spreadWidth; x += step) {
    decorations.push(
      markDecoration(
        new Line([x, 0, x, pageHeight], {
          stroke: 'rgba(65,76,94,.08)',
          strokeWidth: x % (step * 4) === 0 ? 0.9 : 0.45,
        }),
      ),
    );
  }

  for (let y = step; y < pageHeight; y += step) {
    decorations.push(
      markDecoration(
        new Line([0, y, spreadWidth, y], {
          stroke: 'rgba(65,76,94,.08)',
          strokeWidth: y % (step * 4) === 0 ? 0.9 : 0.45,
        }),
      ),
    );
  }

  return decorations;
}
