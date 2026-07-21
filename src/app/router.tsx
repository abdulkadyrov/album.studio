import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { EditorShell } from './layout/EditorShell';
import { NotFoundPage } from '../features/common/NotFoundPage';
import { ProjectSectionPage } from '../features/common/ProjectSectionPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { TemplatesPage } from '../features/templates/TemplatesPage';

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
      {
        path: '/projects/:projectId/import-class',
        element: (
          <ProjectSectionPage
            title="Импорт класса"
            description="Безопасная локальная загрузка пакетов .vsclass появится на этапе 7."
            milestone="Этап 7"
          />
        ),
      },
      {
        path: '/projects/:projectId/participants',
        element: (
          <ProjectSectionPage
            title="Участники"
            description="Ученики, учителя, статусы готовности и массовый выбор появятся на этапе 7."
            milestone="Этап 7"
          />
        ),
      },
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
    element: <EditorShell />,
  },
  { path: '*', element: <NotFoundPage /> },
]);
