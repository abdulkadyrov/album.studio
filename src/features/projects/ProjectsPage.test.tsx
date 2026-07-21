import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProjectsPage } from './ProjectsPage';

describe('ProjectsPage', () => {
  it('показывает честное пустое состояние и отключённое создание проекта', () => {
    render(<ProjectsPage />);

    expect(screen.getByRole('heading', { name: 'Проекты' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Проектов пока нет' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /проект/i })[0]).toBeDisabled();
  });

  it('переключает вид списка локально', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    const gridButton = screen.getByRole('button', { name: 'Сетка' });
    const listButton = screen.getByRole('button', { name: 'Список' });

    expect(gridButton).toHaveClass('is-active');
    await user.click(listButton);
    expect(listButton).toHaveClass('is-active');
  });
});
