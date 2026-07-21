import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { AppSidebar } from './AppSidebar';
import { useUiStore } from '../../stores/ui-store';

describe('AppSidebar', () => {
  beforeEach(() => {
    useUiStore.setState({ accent: 'violet', sidebarCollapsed: false });
  });

  it('содержит основные разделы и сворачивается', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Проекты' })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Шаблоны' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Свернуть панель' }));
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});
