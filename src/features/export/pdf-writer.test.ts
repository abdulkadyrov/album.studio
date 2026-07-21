import { describe, expect, it } from 'vitest';

import { createRasterPdf } from './pdf-writer';
import type { RenderedPage } from './print-renderer';

function fakeRenderedPage(): RenderedPage {
  return {
    title: 'Страница 1',
    widthMm: 200,
    heightMm: 300,
    widthPx: 2362,
    heightPx: 3543,
    widthPt: 566.929,
    heightPt: 850.394,
    canvas: document.createElement('canvas'),
    jpegBlob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    canvasToJpeg: () => Promise.resolve(new Blob()),
    canvasToPng: () => Promise.resolve(new Blob()),
  };
}

describe('pdf writer', () => {
  it('создаёт настоящий PDF с физическим размером страницы', async () => {
    const blob = await createRasterPdf([fakeRenderedPage()]);
    const text = await blob.text();

    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 566.929 850.394]');
    expect(text).toContain('/Subtype /Image');
    expect(text.trim().endsWith('%%EOF')).toBe(true);
  });
});
