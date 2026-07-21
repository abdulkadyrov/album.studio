import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDefaultCanvasDocument,
  createDefaultImageStyle,
} from '../../canvas/model/canvas-document';
import { database } from '../../data/db/database';
import { validateProjectDocument } from './validation-service';

describe('validation service', () => {
  beforeEach(async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });

  it('блокирует экспорт при отсутствующем изображении', async () => {
    const document = createDefaultCanvasDocument('validation-project');
    document.layers = [
      {
        id: 'missing-image-layer',
        pageId: document.pages[0]!.id,
        name: 'Фото',
        kind: 'image',
        visible: true,
        locked: false,
        zIndex: 0,
        xMm: 10,
        yMm: 10,
        widthMm: 60,
        heightMm: 80,
        rotationDeg: 0,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidthMm: 0,
        opacity: 1,
        image: createDefaultImageStyle({
          assetId: 'missing',
          filename: 'missing.jpg',
          mimeType: 'image/jpeg',
          naturalWidthPx: 100,
          naturalHeightPx: 100,
        }),
      },
    ];

    const report = await validateProjectDocument(document);

    expect(report.canExport).toBe(false);
    expect(report.summary.error).toBe(1);
    expect(report.issues[0]?.title).toBe('Не найдено изображение');
  });
});
