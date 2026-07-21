import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { NotFoundPage } from '../features/common/NotFoundPage';
import { ProjectSectionPage } from '../features/common/ProjectSectionPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { TemplatesPage } from '../features/templates/TemplatesPage';
import { ClassImportPage } from '../features/participants/ClassImportPage';
import { ParticipantsPage } from '../features/participants/ParticipantsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/projects" replace />,
  },
  {
    element: <AppShell />,
    children: [
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/templates', element: <TemplatesPage /> },
      { path: '/projects/:projectId/import-class', element: <ClassImportPage /> },
      { path: '/projects/:projectId/participants', element: <ParticipantsPage /> },
      {
        path: '/projects/:projectId/references',
        element: (
          <ProjectSectionPage
            title="Референсы"
            description="Локальная библиотека визуальных примеров появится на этапе 10."
            milestone="Этап 10"
          />
        ),
      },
      {
        path: '/projects/:projectId/ideas',
        element: (
          <ProjectSectionPage
            title="Идеи"
            description="Карточки концепций и связи с макетами появятся на этапе 10."
            milestone="Этап 10"
          />
        ),
      },
      {
        path: '/projects/:projectId/annotations',
        element: (
          <ProjectSectionPage
            title="Аннотации"
            description="Комментарии к страницам и слоям появятся на этапе 10."
            milestone="Этап 10"
          />
        ),
      },
      {
        path: '/projects/:projectId/validation',
        element: (
          <ProjectSectionPage
            title="Проверка проекта"
            description="Контроль изображений, шрифтов, полей и печатного качества появится на этапе 9."
            milestone="Этап 9"
          />
        ),
      },
      {
        path: '/projects/:projectId/export',
        element: (
          <ProjectSectionPage
            title="Экспорт"
            description="Локальный экспорт PNG, JPEG, PDF и ZIP появится на этапе 9."
            milestone="Этап 9"
          />
        ),
      },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '/editor/:projectId',
    lazy: async () => {
      const { EditorShell } = await import('./layout/EditorShell');
      return { Component: EditorShell };
    },
  },
  { path: '*', element: <NotFoundPage /> },
]);
