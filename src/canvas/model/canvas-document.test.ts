import {
  canvasDocumentSchema,
  createDefaultCanvasDocument,
  getSpreadWidthMm,
} from './canvas-document';

describe('canvas document', () => {
  it('создаёт валидный редактируемый разворот', () => {
    const document = createDefaultCanvasDocument('test-project');

    expect(canvasDocumentSchema.parse(document)).toEqual(document);
    expect(getSpreadWidthMm(document.page)).toBe(400);
    expect(document.objects).toHaveLength(2);
  });

  it('отклоняет слой без положительного размера', () => {
    const document = createDefaultCanvasDocument('test-project');
    document.objects[0]!.widthMm = 0;

    expect(canvasDocumentSchema.safeParse(document).success).toBe(false);
  });
});
