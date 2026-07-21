import {
  getPageGroups,
  normalizeDocumentOrder,
  type CanvasDocument,
  type CanvasLayerSnapshot,
  type CanvasPageSnapshot,
} from './canvas-document';

function entityId(projectId: string, kind: string): string {
  return `${projectId}:${kind}-${crypto.randomUUID()}`;
}

function pageDefaults(reference: CanvasPageSnapshot) {
  return {
    widthMm: reference.widthMm,
    heightMm: reference.heightMm,
    bleedMm: reference.bleedMm,
    safeZoneMm: reference.safeZoneMm,
    gridStepMm: reference.gridStepMm,
  };
}

export function addPage(document: CanvasDocument): {
  document: CanvasDocument;
  activePageId: string;
} {
  const reference = document.pages[0]!;
  const page: CanvasPageSnapshot = {
    id: entityId(document.projectId, 'page'),
    title: `Страница ${document.pages.length + 1}`,
    order: document.pages.length,
    ...pageDefaults(reference),
  };
  return {
    document: normalizeDocumentOrder({
      ...document,
      pages: [...document.pages, page],
      updatedAt: new Date().toISOString(),
    }),
    activePageId: page.id,
  };
}

export function addSpread(document: CanvasDocument): {
  document: CanvasDocument;
  activePageId: string;
} {
  const reference = document.pages[0]!;
  const spreadId = entityId(document.projectId, 'spread');
  const firstOrder = document.pages.length;
  const left: CanvasPageSnapshot = {
    id: entityId(document.projectId, 'page'),
    title: `Страница ${firstOrder + 1}`,
    order: firstOrder,
    spreadId,
    spreadSide: 'left',
    ...pageDefaults(reference),
  };
  const right: CanvasPageSnapshot = {
    ...left,
    id: entityId(document.projectId, 'page'),
    title: `Страница ${firstOrder + 2}`,
    order: firstOrder + 1,
    spreadSide: 'right',
  };
  return {
    document: normalizeDocumentOrder({
      ...document,
      pages: [...document.pages, left, right],
      updatedAt: new Date().toISOString(),
    }),
    activePageId: left.id,
  };
}

export function duplicatePageGroup(
  document: CanvasDocument,
  groupId: string,
): { document: CanvasDocument; activePageId: string } {
  const group = getPageGroups(document.pages).find((candidate) => candidate.id === groupId);
  if (!group) return { document, activePageId: document.pages[0]!.id };
  const spreadId = group.pages.length === 2 ? entityId(document.projectId, 'spread') : undefined;
  const pageIdMap = new Map(
    group.pages.map((page) => [page.id, entityId(document.projectId, 'page')]),
  );
  const sourceLayerIds = new Set(
    document.layers.filter((layer) => pageIdMap.has(layer.pageId)).map((layer) => layer.id),
  );
  const layerIdMap = new Map(
    [...sourceLayerIds].map((id) => [id, entityId(document.projectId, 'layer')]),
  );
  const pages = group.pages.map((page, index) => ({
    ...page,
    id: pageIdMap.get(page.id)!,
    title: `${page.title} — копия`,
    order: document.pages.length + index,
    spreadId,
  }));
  const layers: CanvasLayerSnapshot[] = document.layers
    .filter((layer) => pageIdMap.has(layer.pageId))
    .map((layer) => ({
      ...layer,
      id: layerIdMap.get(layer.id)!,
      pageId: pageIdMap.get(layer.pageId)!,
      parentId: layer.parentId ? layerIdMap.get(layer.parentId) : undefined,
    }));
  return {
    document: normalizeDocumentOrder({
      ...document,
      pages: [...document.pages, ...pages],
      layers: [...document.layers, ...layers],
      updatedAt: new Date().toISOString(),
    }),
    activePageId: pages[0]!.id,
  };
}

export function deletePageGroup(
  document: CanvasDocument,
  groupId: string,
): { document: CanvasDocument; activePageId: string } {
  const groups = getPageGroups(document.pages);
  if (groups.length <= 1) return { document, activePageId: document.pages[0]!.id };
  const groupIndex = groups.findIndex((candidate) => candidate.id === groupId);
  if (groupIndex < 0) return { document, activePageId: document.pages[0]!.id };
  const deletedPageIds = new Set(groups[groupIndex]!.pages.map((page) => page.id));
  const nextGroups = groups.filter((candidate) => candidate.id !== groupId);
  const activeGroup = nextGroups[Math.min(groupIndex, nextGroups.length - 1)]!;
  return {
    document: normalizeDocumentOrder({
      ...document,
      pages: document.pages.filter((page) => !deletedPageIds.has(page.id)),
      layers: document.layers.filter((layer) => !deletedPageIds.has(layer.pageId)),
      updatedAt: new Date().toISOString(),
    }),
    activePageId: activeGroup.pages[0]!.id,
  };
}

export function movePageGroup(
  document: CanvasDocument,
  groupId: string,
  direction: -1 | 1,
): CanvasDocument {
  const groups = getPageGroups(document.pages);
  const index = groups.findIndex((group) => group.id === groupId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= groups.length) return document;
  const reordered = [...groups];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex]!, reordered[index]!];
  const pages = reordered
    .flatMap((group) => group.pages)
    .map((page, pageIndex) => ({ ...page, order: pageIndex }));
  return normalizeDocumentOrder({
    ...document,
    pages,
    updatedAt: new Date().toISOString(),
  });
}
