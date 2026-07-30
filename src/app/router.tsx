import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { NotFoundPage } from '../features/common/NotFoundPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { TemplatesPage } from '../features/templates/TemplatesPage';
import { ClassImportPage } from '../features/participants/ClassImportPage';
import { ParticipantsPage } from '../features/participants/ParticipantsPage';
import { ValidationPage } from '../features/validation/ValidationPage';
import { ExportPage } from '../features/export/ExportPage';
import { ReferencesPage } from '../features/workspace-materials/ReferencesPage';
import { IdeasPage } from '../features/workspace-materials/IdeasPage';
import { AnnotationsPage } from '../features/workspace-materials/AnnotationsPage';

export const router = createBrowserRouter(
  [
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
        { path: '/projects/:projectId/references', element: <ReferencesPage /> },
        { path: '/projects/:projectId/ideas', element: <IdeasPage /> },
        { path: '/projects/:projectId/annotations', element: <AnnotationsPage /> },
        { path: '/projects/:projectId/validation', element: <ValidationPage /> },
        { path: '/projects/:projectId/export', element: <ExportPage /> },
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
  ],
  {
    basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
  },
);
