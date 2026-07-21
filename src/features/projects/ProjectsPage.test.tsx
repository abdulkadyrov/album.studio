import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ProjectsPage } from './ProjectsPage';

describe('ProjectsPage', () => {
  it('показывает честное пустое состояние и переход в каталог', async () => {
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Проекты' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Проектов пока нет' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать из шаблона' })).toBeEnabled();
  });

  it('переключает вид списка локально', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    const gridButton = screen.getByRole('button', { name: 'Сетка' });
    const listButton = screen.getByRole('button', { name: 'Список' });

    expect(gridButton).toHaveClass('is-active');
    await user.click(listButton);
    expect(listButton).toHaveClass('is-active');
  });
});
