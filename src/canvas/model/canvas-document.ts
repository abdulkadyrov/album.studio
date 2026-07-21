import { z } from 'zod';

export const canvasLayerKindSchema = z.enum(['rect', 'circle', 'group']);

export const canvasLayerSchema = z.object({
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
});

export const canvasDocumentSchema = z.object({
  version: z.literal(2),
  projectId: z.string().min(1),
  pages: z.array(canvasPageSchema).min(1),
  layers: z.array(canvasLayerSchema),
  updatedAt: z.string().datetime(),
});

export type CanvasLayerKind = z.infer<typeof canvasLayerKindSchema>;
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
