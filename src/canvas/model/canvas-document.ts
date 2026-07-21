import { z } from 'zod';

export const canvasObjectKindSchema = z.enum(['rect', 'circle']);

export const canvasObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: canvasObjectKindSchema,
  xMm: z.number().finite(),
  yMm: z.number().finite(),
  widthMm: z.number().positive().finite(),
  heightMm: z.number().positive().finite(),
  rotationDeg: z.number().finite(),
  fill: z.string().min(1),
  stroke: z.string().min(1),
  strokeWidthMm: z.number().nonnegative().finite(),
  opacity: z.number().min(0).max(1),
});

export const canvasPageSchema = z.object({
  id: z.string().min(1),
  widthMm: z.number().positive().finite(),
  heightMm: z.number().positive().finite(),
  spread: z.boolean(),
  bleedMm: z.number().nonnegative().finite(),
  safeZoneMm: z.number().nonnegative().finite(),
  gridStepMm: z.number().positive().finite(),
});

export const canvasDocumentSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1),
  page: canvasPageSchema,
  objects: z.array(canvasObjectSchema),
  updatedAt: z.string().datetime(),
});

export type CanvasObjectKind = z.infer<typeof canvasObjectKindSchema>;
export type CanvasObjectSnapshot = z.infer<typeof canvasObjectSchema>;
export type CanvasPageSnapshot = z.infer<typeof canvasPageSchema>;
export type CanvasDocument = z.infer<typeof canvasDocumentSchema>;

export function getSpreadWidthMm(page: CanvasPageSnapshot): number {
  return page.widthMm * (page.spread ? 2 : 1);
}

export function createDefaultCanvasDocument(projectId: string): CanvasDocument {
  return {
    version: 1,
    projectId,
    page: {
      id: `${projectId}:spread-main`,
      widthMm: 200,
      heightMm: 200,
      spread: true,
      bleedMm: 3,
      safeZoneMm: 5,
      gridStepMm: 5,
    },
    objects: [
      {
        id: `${projectId}:object-geometry`,
        name: 'Геометрический блок',
        kind: 'rect',
        xMm: 44,
        yMm: 48,
        widthMm: 66,
        heightMm: 82,
        rotationDeg: -4,
        fill: '#7657e8',
        stroke: '#9f8af0',
        strokeWidthMm: 0.7,
        opacity: 0.94,
      },
      {
        id: `${projectId}:object-accent`,
        name: 'Круглый акцент',
        kind: 'circle',
        xMm: 272,
        yMm: 67,
        widthMm: 58,
        heightMm: 58,
        rotationDeg: 0,
        fill: '#3f7ce8',
        stroke: '#86aef5',
        strokeWidthMm: 0.7,
        opacity: 0.9,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}
