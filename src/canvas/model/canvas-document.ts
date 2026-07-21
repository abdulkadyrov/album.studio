import { z } from 'zod';

export const canvasLayerKindSchema = z.enum([
  'rect',
  'circle',
  'group',
  'text',
  'image',
  'frame',
  'decoration',
  'background',
]);

export const textCaseSchema = z.enum(['original', 'upper', 'lower', 'title', 'sentence']);
export const textOverflowModeSchema = z.enum(['warn', 'shrink', 'clip', 'wrap']);
export const textBoxModeSchema = z.enum(['auto', 'fixed']);

export const layerBindingSchema = z.object({
  source: z.enum(['project', 'class', 'participant', 'teacher']),
  field: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/),
  fallback: z.string().optional(),
});

export const textShadowSchema = z.object({
  enabled: z.boolean(),
  color: z.string().min(1),
  opacity: z.number().min(0).max(1),
  blur: z.number().nonnegative().finite(),
  offsetXmm: z.number().finite(),
  offsetYmm: z.number().finite(),
});

export const textStyleSchema = z.object({
  content: z.string(),
  fontFamily: z.string().min(1),
  fontAssetId: z.string().min(1).optional(),
  fontSizePt: z.number().positive().finite(),
  minFontSizePt: z.number().positive().finite(),
  fontWeight: z.enum(['normal', 'bold', '300', '500', '600', '700', '800', '900']),
  fontStyle: z.enum(['normal', 'italic']),
  underline: z.boolean(),
  linethrough: z.boolean(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  letterSpacingEm: z.number().min(-0.2).max(2).finite(),
  lineHeight: z.number().min(0.5).max(4).finite(),
  textCase: textCaseSchema,
  paddingMm: z.number().nonnegative().finite(),
  direction: z.enum(['ltr', 'rtl']),
  boxMode: textBoxModeSchema,
  maxLines: z.number().int().positive().max(100).optional(),
  overflowMode: textOverflowModeSchema,
  shadow: textShadowSchema,
});

export const imageEffectsSchema = z.object({
  brightness: z.number().min(-1).max(1),
  contrast: z.number().min(-1).max(1),
  saturation: z.number().min(-1).max(1),
  exposure: z.number().min(-1).max(1),
  hue: z.number().min(-1).max(1),
  blur: z.number().min(0).max(1),
  grayscale: z.boolean(),
  sepia: z.boolean(),
});

export const imageStyleSchema = z.object({
  assetId: z.string().min(1),
  thumbnailAssetId: z.string().min(1).optional(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  naturalWidthPx: z.number().int().positive(),
  naturalHeightPx: z.number().int().positive(),
  fit: z.enum(['cover', 'contain']),
  frameShape: z.enum(['rectangle', 'rounded', 'circle', 'oval', 'polygon', 'svg']),
  svgMaskAssetId: z.string().min(1).optional(),
  cropX: z.number().min(0).max(1),
  cropY: z.number().min(0).max(1),
  zoom: z.number().min(0.1).max(20),
  imageRotationDeg: z.number().finite(),
  flipX: z.boolean(),
  flipY: z.boolean(),
  cornerRadiusMm: z.number().nonnegative().finite(),
  effects: imageEffectsSchema,
  shadow: textShadowSchema,
});

export const canvasLayerSchema = z
  .object({
    id: z.string().min(1),
    pageId: z.string().min(1),
    parentId: z.string().min(1).optional(),
    name: z.string().min(1),
    kind: canvasLayerKindSchema,
    visible: z.boolean(),
    locked: z.boolean(),
    zIndex: z.number().int().nonnegative(),
    xMm: z.number().finite(),
    yMm: z.number().finite(),
    widthMm: z.number().positive().finite(),
    heightMm: z.number().positive().finite(),
    rotationDeg: z.number().finite(),
    fill: z.string().min(1),
    stroke: z.string().min(1),
    strokeWidthMm: z.number().nonnegative().finite(),
    opacity: z.number().min(0).max(1),
    binding: layerBindingSchema.optional(),
    text: textStyleSchema.optional(),
    image: imageStyleSchema.optional(),
  })
  .superRefine((layer, context) => {
    if (layer.kind === 'text' && !layer.text) {
      context.addIssue({
        code: 'custom',
        path: ['text'],
        message: 'Текстовый слой требует настройки текста',
      });
    }
    if (['image', 'decoration', 'background'].includes(layer.kind) && !layer.image) {
      context.addIssue({
        code: 'custom',
        path: ['image'],
        message: 'Слой изображения требует ссылку на локальный ресурс',
      });
    }
    if (layer.text && layer.text.minFontSizePt > layer.text.fontSizePt) {
      context.addIssue({
        code: 'custom',
        path: ['text', 'minFontSizePt'],
        message: 'Минимальный размер не может превышать основной',
      });
    }
  });

export const canvasPageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  spreadId: z.string().min(1).optional(),
  spreadSide: z.enum(['left', 'right']).optional(),
  widthMm: z.number().positive().finite(),
  heightMm: z.number().positive().finite(),
  bleedMm: z.number().nonnegative().finite(),
  safeZoneMm: z.number().nonnegative().finite(),
  gridStepMm: z.number().positive().finite(),
  pageType: z
    .enum(['cover', 'portrait', 'group', 'teachers', 'class', 'events', 'closing', 'universal'])
    .optional(),
  repeatFor: z.enum(['none', 'student', 'teacher']).optional(),
});

export const canvasDocumentSchema = z.object({
  version: z.literal(2),
  projectId: z.string().min(1),
  pages: z.array(canvasPageSchema).min(1),
  layers: z.array(canvasLayerSchema),
  updatedAt: z.string().datetime(),
});

export type CanvasLayerKind = z.infer<typeof canvasLayerKindSchema>;
export type LayerBinding = z.infer<typeof layerBindingSchema>;
export type CanvasTextStyle = z.infer<typeof textStyleSchema>;
export type CanvasImageStyle = z.infer<typeof imageStyleSchema>;
export type TextCase = z.infer<typeof textCaseSchema>;
export type TextOverflowMode = z.infer<typeof textOverflowModeSchema>;
export type CanvasLayerSnapshot = z.infer<typeof canvasLayerSchema>;
export type CanvasObjectSnapshot = CanvasLayerSnapshot;
export type CanvasPageSnapshot = z.infer<typeof canvasPageSchema>;
export type CanvasDocument = z.infer<typeof canvasDocumentSchema>;

export interface CanvasPageLayout {
  widthMm: number;
  heightMm: number;
  spread: boolean;
  bleedMm: number;
  safeZoneMm: number;
  gridStepMm: number;
}

export interface CanvasPageGroup {
  id: string;
  title: string;
  pages: CanvasPageSnapshot[];
}

export function createDefaultTextStyle(): CanvasTextStyle {
  return {
    content: 'Введите текст',
    fontFamily: 'sans-serif',
    fontSizePt: 28,
    minFontSizePt: 10,
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    linethrough: false,
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacingEm: 0,
    lineHeight: 1.16,
    textCase: 'original',
    paddingMm: 2,
    direction: 'ltr',
    boxMode: 'fixed',
    maxLines: 4,
    overflowMode: 'warn',
    shadow: {
      enabled: false,
      color: '#000000',
      opacity: 0.35,
      blur: 4,
      offsetXmm: 1,
      offsetYmm: 1,
    },
  };
}

export function createDefaultImageStyle(
  asset: Pick<
    CanvasImageStyle,
    'assetId' | 'thumbnailAssetId' | 'filename' | 'mimeType' | 'naturalWidthPx' | 'naturalHeightPx'
  >,
): CanvasImageStyle {
  return {
    ...asset,
    fit: 'cover',
    frameShape: 'rectangle',
    cropX: 0.5,
    cropY: 0.5,
    zoom: 1,
    imageRotationDeg: 0,
    flipX: false,
    flipY: false,
    cornerRadiusMm: 0,
    effects: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      hue: 0,
      blur: 0,
      grayscale: false,
      sepia: false,
    },
    shadow: {
      enabled: false,
      color: '#000000',
      opacity: 0.35,
      blur: 8,
      offsetXmm: 2,
      offsetYmm: 2,
    },
  };
}

export function getSpreadWidthMm(page: CanvasPageLayout): number {
  return page.widthMm * (page.spread ? 2 : 1);
}

export function getPageGroups(pages: CanvasPageSnapshot[]): CanvasPageGroup[] {
  const groups = new Map<string, CanvasPageSnapshot[]>();
  [...pages]
    .sort((left, right) => left.order - right.order)
    .forEach((page) => {
      const key = page.spreadId ?? page.id;
      groups.set(key, [...(groups.get(key) ?? []), page]);
    });

  return [...groups.entries()].map(([id, groupedPages]) => {
    const sortedPages = groupedPages.sort((left, right) => {
      if (left.spreadSide === right.spreadSide) return left.order - right.order;
      return left.spreadSide === 'left' ? -1 : 1;
    });
    return {
      id,
      title:
        sortedPages.length === 2
          ? `${sortedPages[0]?.title} — ${sortedPages[1]?.title}`
          : (sortedPages[0]?.title ?? 'Страница'),
      pages: sortedPages,
    };
  });
}

export function getActivePageGroup(
  document: CanvasDocument,
  activePageId: string,
): CanvasPageGroup {
  return (
    getPageGroups(document.pages).find((group) =>
      group.pages.some((page) => page.id === activePageId),
    ) ?? getPageGroups(document.pages)[0]!
  );
}

export function getPageLayout(group: CanvasPageGroup): CanvasPageLayout {
  const reference = group.pages[0]!;
  return {
    widthMm: reference.widthMm,
    heightMm: reference.heightMm,
    spread: group.pages.length === 2,
    bleedMm: reference.bleedMm,
    safeZoneMm: reference.safeZoneMm,
    gridStepMm: reference.gridStepMm,
  };
}

export function normalizeDocumentOrder(document: CanvasDocument): CanvasDocument {
  const pages = [...document.pages]
    .sort((left, right) => left.order - right.order)
    .map((page, index) => ({ ...page, order: index }));
  const pageIds = new Set(pages.map((page) => page.id));
  const layers = document.layers
    .filter((layer) => pageIds.has(layer.pageId))
    .map((layer) => ({ ...layer }))
    .sort((left, right) => left.zIndex - right.zIndex);

  pages.forEach((page) => {
    layers
      .filter((layer) => layer.pageId === page.id)
      .forEach((layer, index) => {
        layer.zIndex = index;
      });
  });

  return { ...document, pages, layers };
}

export function createDefaultCanvasDocument(projectId: string): CanvasDocument {
  const spreadId = `${projectId}:spread-main`;
  const leftPageId = `${projectId}:page-left`;
  const rightPageId = `${projectId}:page-right`;
  const pageDefaults = {
    widthMm: 200,
    heightMm: 200,
    bleedMm: 3,
    safeZoneMm: 5,
    gridStepMm: 5,
  };

  return {
    version: 2,
    projectId,
    pages: [
      {
        id: leftPageId,
        title: 'Страница 1',
        order: 0,
        spreadId,
        spreadSide: 'left',
        ...pageDefaults,
      },
      {
        id: rightPageId,
        title: 'Страница 2',
        order: 1,
        spreadId,
        spreadSide: 'right',
        ...pageDefaults,
      },
    ],
    layers: [
      {
        id: `${projectId}:object-geometry`,
        pageId: leftPageId,
        name: 'Геометрический блок',
        kind: 'rect',
        visible: true,
        locked: false,
        zIndex: 0,
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
        pageId: rightPageId,
        name: 'Круглый акцент',
        kind: 'circle',
        visible: true,
        locked: false,
        zIndex: 0,
        xMm: 72,
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
