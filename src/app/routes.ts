export const routes = {
  projects: '/projects',
  templates: '/templates',
  editor: (projectId: string) => `/editor/${projectId}`,
  importClass: (projectId: string) => `/projects/${projectId}/import-class`,
  participants: (projectId: string) => `/projects/${projectId}/participants`,
  references: (projectId: string) => `/projects/${projectId}/references`,
  ideas: (projectId: string) => `/projects/${projectId}/ideas`,
  annotations: (projectId: string) => `/projects/${projectId}/annotations`,
  validation: (projectId: string) => `/projects/${projectId}/validation`,
  export: (projectId: string) => `/projects/${projectId}/export`,
  settings: '/settings',
} as const;

export const previewProjectId = 'preview';
