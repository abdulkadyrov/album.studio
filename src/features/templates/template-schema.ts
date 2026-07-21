import { z } from 'zod';

import { canvasDocumentSchema } from '../../canvas/model/canvas-document';

export const templateCategorySchema = z.enum([
  'kindergarten',
  'grade-1',
  'grade-4',
  'grade-9',
  'grade-11',
  'teachers',
  'general',
  'covers',
]);

export const templateStyleSchema = z.enum([
  'classic',
  'modern',
  'minimal',
  'geometric',
  'watercolor',
  'school',
  'premium',
  'gentle',
  'dark',
  'bright',
  'national',
]);

export const templateColorSchema = z.enum([
  'light',
  'dark',
  'red',
  'blue',
  'green',
  'gold',
  'multicolor',
]);

export const templateAssetSchema = z.object({
  id: z.string().min(1),
  path: z.string().regex(/^assets\/[a-zA-Z0-9._-]+$/),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  kind: z.enum(['image', 'thumbnail', 'font', 'svg', 'decoration']),
  byteSize: z
    .number()
    .int()
    .nonnegative()
    .max(500 * 1024 * 1024),
  hash: z.string().optional(),
  sourceAssetId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const templateManifestSchema = z.object({
  format: z.literal('vakha-template'),
  version: z.literal(1),
  template: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    description: z.string().max(800),
    category: templateCategorySchema,
    style: templateStyleSchema,
    color: templateColorSchema,
    orientation: z.enum(['square', 'portrait', 'landscape']),
    source: z.enum(['system', 'user', 'codex']),
    favorite: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  document: canvasDocumentSchema,
  assets: z.array(templateAssetSchema).max(5000),
});

export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type TemplateStyle = z.infer<typeof templateStyleSchema>;
export type TemplateColor = z.infer<typeof templateColorSchema>;
export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export const templateCategoryLabels: Record<TemplateCategory, string> = {
  kindergarten: 'Детский сад',
  'grade-1': '1 класс',
  'grade-4': '4 класс',
  'grade-9': '9 класс',
  'grade-11': '11 класс',
  teachers: 'Учителя',
  general: 'Общие страницы',
  covers: 'Обложки',
};

export const templateStyleLabels: Record<TemplateStyle, string> = {
  classic: 'Классический',
  modern: 'Современный',
  minimal: 'Минимализм',
  geometric: 'Геометрический',
  watercolor: 'Акварель',
  school: 'Школьный',
  premium: 'Премиальный',
  gentle: 'Нежный',
  dark: 'Тёмный',
  bright: 'Яркий',
  national: 'Национальный орнамент',
};
