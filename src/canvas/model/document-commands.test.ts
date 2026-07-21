import { createDefaultCanvasDocument, getPageGroups } from './canvas-document';
import {
  addPage,
  addSpread,
  deletePageGroup,
  duplicatePageGroup,
  movePageGroup,
} from './document-commands';

describe('document page commands', () => {
  it('добавляет одиночную страницу и самостоятельный разворот', () => {
    const initial = createDefaultCanvasDocument('commands');
    const withPage = addPage(initial);
    const withSpread = addSpread(withPage.document);

    expect(withPage.document.pages).toHaveLength(3);
    expect(getPageGroups(withSpread.document.pages)).toHaveLength(3);
    expect(getPageGroups(withSpread.document.pages).at(-1)?.pages).toHaveLength(2);
  });

  it('дублирует разворот вместе со слоями и новыми identity', () => {
    const initial = createDefaultCanvasDocument('commands');
    const sourceGroup = getPageGroups(initial.pages)[0]!;
    const result = duplicatePageGroup(initial, sourceGroup.id);

    expect(result.document.pages).toHaveLength(4);
    expect(result.document.layers).toHaveLength(4);
    expect(new Set(result.document.layers.map((layer) => layer.id)).size).toBe(4);
    expect(
      result.document.layers.filter((layer) => layer.pageId === result.activePageId),
    ).toHaveLength(1);
  });

  it('переставляет и удаляет группы страниц без осиротевших слоёв', () => {
    const initial = createDefaultCanvasDocument('commands');
    const withPage = addPage(initial).document;
    const groups = getPageGroups(withPage.pages);
    const moved = movePageGroup(withPage, groups[1]!.id, -1);
    expect(getPageGroups(moved.pages)[0]?.id).toBe(groups[1]!.id);

    const deleted = deletePageGroup(moved, groups[0]!.id);
    const pageIds = new Set(deleted.document.pages.map((page) => page.id));
    expect(deleted.document.pages).toHaveLength(1);
    expect(deleted.document.layers.every((layer) => pageIds.has(layer.pageId))).toBe(true);
  });
});
