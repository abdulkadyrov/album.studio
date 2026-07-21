import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { database } from '../../data/db/database';
import { ParticipantsPage } from './ParticipantsPage';

async function seedParticipants() {
  await database.participants.bulkPut([
    {
      id: 'p1',
      projectId: 'project-a',
      type: 'student',
      firstName: 'Александр',
      lastName: 'Иванов',
      status: 'ready',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p2',
      projectId: 'project-a',
      type: 'teacher',
      firstName: 'Мария',
      lastName: 'Петрова',
      status: 'needs-review',
      updatedAt: new Date().toISOString(),
    },
  ]);
}

describe('ParticipantsPage', () => {
  beforeEach(async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });

  it('показывает участников, фильтры и массовую смену статуса', async () => {
    const user = userEvent.setup();
    await seedParticipants();
    render(
      <MemoryRouter initialEntries={['/projects/project-a/participants']}>
        <Routes>
          <Route path="/projects/:projectId/participants" element={<ParticipantsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Иванов Александр')).toBeInTheDocument();
    expect(screen.getByText('Петрова Мария')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Тип участника'), 'teacher');
    expect(screen.queryByText('Иванов Александр')).not.toBeInTheDocument();
    expect(screen.getByText('Петрова Мария')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Выбрать видимых' }));
    await user.selectOptions(screen.getByLabelText('Назначить статус выбранным'), 'approved');

    await waitFor(async () => {
      expect((await database.participants.get('p2'))?.status).toBe('approved');
    });
  });
});
