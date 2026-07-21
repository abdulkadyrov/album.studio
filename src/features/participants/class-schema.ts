import { z } from 'zod';

export const participantStatusSchema = z.enum([
  'new',
  'needs-photo',
  'needs-review',
  'ready',
  'approved',
  'hidden',
]);

export type ParticipantStatus = z.infer<typeof participantStatusSchema>;

export const participantStatusLabels: Record<ParticipantStatus, string> = {
  new: 'Новый',
  'needs-photo': 'Нужно фото',
  'needs-review': 'На проверке',
  ready: 'Готов',
  approved: 'Одобрен',
  hidden: 'Скрыт',
};

const photoSchema = z.object({
  path: z.string().min(1),
  role: z.enum(['main', 'additional']).default('main'),
  order: z.number().int().nonnegative().default(0),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  byteSize: z.number().int().positive().optional(),
});

const personSchema = z.object({
  externalId: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  middleName: z.string().trim().optional(),
  displayName: z.string().trim().optional(),
  role: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  status: participantStatusSchema.default('needs-review'),
  photos: z.array(photoSchema).default([]),
});

export const classManifestSchema = z.object({
  format: z.literal('vakha-class'),
  version: z.literal(1),
  class: z.object({
    schoolName: z.string().trim().optional(),
    className: z.string().trim().optional(),
    academicYear: z.string().trim().optional(),
    curatorName: z.string().trim().optional(),
  }),
  students: z.array(personSchema).default([]),
  teachers: z.array(personSchema).default([]),
});

export type ClassManifest = z.infer<typeof classManifestSchema>;
export type ClassManifestPerson = ClassManifest['students'][number];

export const classImportStrategySchema = z.enum(['append', 'merge', 'replace']);
export type ClassImportStrategy = z.infer<typeof classImportStrategySchema>;

export const classImportStrategyLabels: Record<ClassImportStrategy, string> = {
  append: 'Добавить как новых',
  merge: 'Обновить совпадения',
  replace: 'Заменить класс',
};
