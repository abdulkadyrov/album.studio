import { z } from 'zod';

import { canvasDocumentSchema } from '../../canvas/model/canvas-document';
import { classManifestSchema } from '../participants/class-schema';

export const albumManifestSchema = z.object({
  format: z.literal('vakha-album'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  project: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    schoolName: z.string(),
    className: z.string(),
    academicYear: z.string(),
  }),
  document: canvasDocumentSchema,
  participants: classManifestSchema.pick({ students: true, teachers: true }),
  overrides: z.array(
    z.object({
      participantExternalId: z.string().optional(),
      participantId: z.string(),
      pageId: z.string(),
      layerId: z.string(),
      patch: z.record(z.string(), z.unknown()),
    }),
  ),
  assets: z.array(
    z.object({
      id: z.string().min(1),
      path: z.string().regex(/^assets\/[^/].*/),
      filename: z.string().min(1),
      mimeType: z.string().min(1),
      kind: z.enum(['image', 'thumbnail', 'font', 'svg', 'decoration']),
      byteSize: z.number().int().nonnegative(),
      sourceAssetId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export type AlbumManifest = z.infer<typeof albumManifestSchema>;
