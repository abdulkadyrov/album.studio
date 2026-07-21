import {
  canvasDocumentSchema,
  createDefaultCanvasDocument,
  getActivePageGroup,
  getPageLayout,
  getSpreadWidthMm,
} from './canvas-document';

describe('canvas document', () => {
  it('создаёт валидный редактируемый разворот', () => {
    const document = createDefaultCanvasDocument('test-project');

    expect(canvasDocumentSchema.parse(document)).toEqual(document);
    const group = getActivePageGroup(document, document.pages[0]!.id);
    expect(getSpreadWidthMm(getPageLayout(group))).toBe(400);
    expect(document.pages).toHaveLength(2);
    expect(document.layers).toHaveLength(2);
    expect(document.pages[0]?.spreadId).toBe(document.pages[1]?.spreadId);
  });

  it('отклоняет слой без положительного размера', () => {
    const document = createDefaultCanvasDocument('test-project');
    document.layers[0]!.widthMm = 0;

    expect(canvasDocumentSchema.safeParse(document).success).toBe(false);
  });
});
