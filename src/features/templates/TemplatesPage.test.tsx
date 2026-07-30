import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { TemplatesPage } from './TemplatesPage';

describe('TemplatesPage', () => {
  it('показывает системные шаблоны, фильтрует и открывает страницы', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Редакционный красный')).toBeInTheDocument();
    expect(screen.getByText('Выпускной 2026 · бордовая редакция')).toBeInTheDocument();
    expect(screen.getByText('Выпускной 2026 · микс референсов')).toBeInTheDocument();
    expect(screen.getByText('Санкт-Петербург · мрамор')).toBeInTheDocument();
    expect(screen.getByText('Школьная доска')).toBeInTheDocument();
    expect(screen.getByText('Премьера')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Стиль шаблона'), 'school');
    expect(screen.getByText('Школьная доска')).toBeInTheDocument();
    expect(screen.queryByText('Премьера')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Стиль шаблона'), 'all');
    await user.click(screen.getByRole('button', { name: 'Предпросмотр Редакционный красный' }));
    expect(screen.getByRole('dialog', { name: 'Предпросмотр Редакционный красный' })).toBeVisible();
    expect(screen.getByText(/repeatFor: student/)).toBeInTheDocument();
  });

  it('добавляет системный шаблон в избранное', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>,
    );
    const favorite = await screen.findByRole('button', {
      name: 'В избранное Редакционный красный',
    });
    await user.click(favorite);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Убрать из избранного Редакционный красный' }),
      ).toBeVisible(),
    );
  });
});
