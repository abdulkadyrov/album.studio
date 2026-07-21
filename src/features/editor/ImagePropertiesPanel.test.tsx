import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultImageStyle,
  type CanvasLayerSnapshot,
} from '../../canvas/model/canvas-document';
import { ImagePropertiesPanel } from './ImagePropertiesPanel';

const layer: CanvasLayerSnapshot = {
  id: 'image-1',
  pageId: 'page-1',
  name: 'Фото',
  kind: 'frame',
  visible: true,
  locked: false,
  zIndex: 0,
  xMm: 10,
  yMm: 10,
  widthMm: 100,
  heightMm: 80,
  rotationDeg: 0,
  fill: 'transparent',
  stroke: '#ffffff',
  strokeWidthMm: 1,
  opacity: 1,
  image: createDefaultImageStyle({
    assetId: 'asset-1',
    filename: 'portrait.webp',
    mimeType: 'image/webp',
    naturalWidthPx: 800,
    naturalHeightPx: 600,
  }),
};

describe('ImagePropertiesPanel', () => {
  it('показывает DPI и обновляет неразрушающий crop', () => {
    const onUpdate = vi.fn();
    render(
      <ImagePropertiesPanel
        layer={layer}
        issue={{ effectiveDpi: 148, lowQuality: true, missing: false, missingMask: false }}
        onUpdate={onUpdate}
        onReplace={vi.fn()}
        onUploadMask={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/148 DPI/)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Фокус по X'), { target: { value: '0.25' } });
    expect(onUpdate).toHaveBeenCalledWith({ image: { cropX: 0.25 } });
  });

  it('показывает отсутствие оригинала явно', () => {
    render(
      <ImagePropertiesPanel
        layer={layer}
        issue={{ effectiveDpi: 300, lowQuality: false, missing: true, missingMask: false }}
        onUpdate={vi.fn()}
        onReplace={vi.fn()}
        onUploadMask={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Оригинал изображения отсутствует/);
  });
});
