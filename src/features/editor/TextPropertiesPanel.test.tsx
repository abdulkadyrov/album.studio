import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createDefaultTextStyle,
  type CanvasLayerSnapshot,
} from '../../canvas/model/canvas-document';
import { TextPropertiesPanel } from './TextPropertiesPanel';

const layer: CanvasLayerSnapshot = {
  id: 'text-1',
  pageId: 'page-1',
  name: 'Заголовок',
  kind: 'text',
  visible: true,
  locked: false,
  zIndex: 1,
  xMm: 10,
  yMm: 12,
  widthMm: 100,
  heightMm: 30,
  rotationDeg: 0,
  fill: '#202737',
  stroke: '#000000',
  strokeWidthMm: 0,
  opacity: 1,
  text: createDefaultTextStyle(),
};

describe('TextPropertiesPanel', () => {
  it('показывает missing-font и отправляет изменения содержимого и типографики', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <TextPropertiesPanel
        layer={{ ...layer, text: { ...layer.text!, fontFamily: 'Missing Font' } }}
        fonts={[]}
        issue={{ overflow: true, missingFont: true }}
        onUpdate={onUpdate}
        onUploadFont={vi.fn()}
        onDeleteFont={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Missing Font');
    expect(screen.getByText(/Текст не помещается/)).toBeVisible();

    const content = screen.getByLabelText('Содержимое текста');
    await user.clear(content);
    await user.type(content, 'Новый заголовок');
    await user.tab();
    expect(onUpdate).toHaveBeenCalledWith({ text: { content: 'Новый заголовок' } });

    await user.click(screen.getByRole('button', { name: 'Жирный' }));
    expect(onUpdate).toHaveBeenCalledWith({ text: { fontWeight: 'bold' } });
  });
});
