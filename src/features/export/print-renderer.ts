import type {
  CanvasDocument,
  CanvasLayerSnapshot,
  CanvasPageGroup,
} from '../../canvas/model/canvas-document';
import { getPageGroups } from '../../canvas/model/canvas-document';
import { database } from '../../data/db/database';
import { millimetersToPixels } from '../../utils/dimensions';

export interface RenderPageInput {
  document: CanvasDocument;
  group: CanvasPageGroup;
  dpi: number;
  spread: boolean;
}

export interface RenderedPage {
  title: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  widthPt: number;
  heightPt: number;
  canvas: HTMLCanvasElement;
  jpegBlob?: Blob;
  pngBlob?: Blob;
  canvasToJpeg: () => Promise<Blob>;
  canvasToPng: () => Promise<Blob>;
}

function px(mm: number, dpi: number): number {
  return Math.max(1, Math.round(millimetersToPixels(mm, dpi)));
}

function pt(mm: number): number {
  return Number(((mm / 25.4) * 72).toFixed(3));
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось создать файл экспорта'))),
      type,
      quality,
    ),
  );
}

async function imageForAsset(assetId: string): Promise<HTMLImageElement | undefined> {
  const asset = await database.assets.get(assetId);
  if (!asset) return undefined;
  const url = URL.createObjectURL(asset.blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawText(
  context: CanvasRenderingContext2D,
  layer: CanvasLayerSnapshot,
  dpi: number,
  offsetXmm: number,
): void {
  const text = layer.text;
  if (!text) return;
  const left = px(layer.xMm + offsetXmm, dpi);
  const top = px(layer.yMm, dpi);
  const width = px(layer.widthMm, dpi);
  const lineHeight = (text.fontSizePt / 72) * dpi * text.lineHeight;
  const padding = px(text.paddingMm, dpi);
  const lines = text.content.split(/\r?\n/);
  context.save();
  context.translate(left, top);
  context.rotate((layer.rotationDeg * Math.PI) / 180);
  context.globalAlpha = layer.opacity;
  context.fillStyle = layer.fill;
  context.font = `${text.fontStyle} ${text.fontWeight} ${(text.fontSizePt / 72) * dpi}px ${
    text.fontFamily
  }`;
  context.textBaseline = 'top';
  context.textAlign =
    text.textAlign === 'center' ? 'center' : text.textAlign === 'right' ? 'right' : 'left';
  const x =
    text.textAlign === 'center'
      ? width / 2
      : text.textAlign === 'right'
        ? width - padding
        : padding;
  lines.slice(0, text.maxLines ?? lines.length).forEach((line, index) => {
    context.fillText(line, x, padding + index * lineHeight, width - padding * 2);
  });
  context.restore();
}

function drawShape(
  context: CanvasRenderingContext2D,
  layer: CanvasLayerSnapshot,
  dpi: number,
  offsetXmm: number,
): void {
  const left = px(layer.xMm + offsetXmm, dpi);
  const top = px(layer.yMm, dpi);
  const width = px(layer.widthMm, dpi);
  const height = px(layer.heightMm, dpi);
  context.save();
  context.translate(left, top);
  context.rotate((layer.rotationDeg * Math.PI) / 180);
  context.globalAlpha = layer.opacity;
  context.fillStyle = layer.fill;
  context.strokeStyle = layer.stroke === 'transparent' ? 'rgba(0,0,0,0)' : layer.stroke;
  context.lineWidth = px(layer.strokeWidthMm, dpi);
  if (layer.kind === 'circle') {
    context.beginPath();
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.fill();
    if (layer.strokeWidthMm > 0) context.stroke();
  } else {
    context.fillRect(0, 0, width, height);
    if (layer.strokeWidthMm > 0) context.strokeRect(0, 0, width, height);
  }
  context.restore();
}

async function drawImageLayer(
  context: CanvasRenderingContext2D,
  layer: CanvasLayerSnapshot,
  dpi: number,
  offsetXmm: number,
): Promise<void> {
  if (!layer.image) return;
  const image = await imageForAsset(layer.image.assetId);
  if (!image) {
    drawShape(
      context,
      { ...layer, fill: '#e6e8ef', stroke: '#8d96a8', strokeWidthMm: 0.4 },
      dpi,
      offsetXmm,
    );
    return;
  }
  const left = px(layer.xMm + offsetXmm, dpi);
  const top = px(layer.yMm, dpi);
  const width = px(layer.widthMm, dpi);
  const height = px(layer.heightMm, dpi);
  context.save();
  context.translate(left, top);
  context.rotate((layer.rotationDeg * Math.PI) / 180);
  context.globalAlpha = layer.opacity;
  if (layer.image.frameShape === 'circle' || layer.image.frameShape === 'oval') {
    context.beginPath();
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.clip();
  }
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (layer.image.fit === 'cover') {
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) * layer.image.cropX;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) * layer.image.cropY;
    }
  }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  if (layer.strokeWidthMm > 0 && layer.stroke !== 'transparent') {
    context.strokeStyle = layer.stroke;
    context.lineWidth = px(layer.strokeWidthMm, dpi);
    context.strokeRect(0, 0, width, height);
  }
  context.restore();
}

export async function renderPage(input: RenderPageInput): Promise<RenderedPage> {
  const pages = input.spread ? input.group.pages : [input.group.pages[0]!];
  const pageWidthMm = pages[0]!.widthMm;
  const widthMm = input.spread ? pageWidthMm * pages.length : pageWidthMm;
  const heightMm = Math.max(...pages.map((page) => page.heightMm));
  const canvas = document.createElement('canvas');
  canvas.width = px(widthMm, input.dpi);
  canvas.height = px(heightMm, input.dpi);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas export недоступен');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const pageOffsets = new Map(pages.map((page, index) => [page.id, index * pageWidthMm]));
  const pageIds = new Set(pages.map((page) => page.id));
  const layers = input.document.layers
    .filter((layer) => pageIds.has(layer.pageId) && layer.kind !== 'group' && layer.visible)
    .sort((left, right) => left.zIndex - right.zIndex);
  for (const layer of layers) {
    const offsetXmm = pageOffsets.get(layer.pageId) ?? 0;
    if (layer.text) drawText(context, layer, input.dpi, offsetXmm);
    else if (layer.image) await drawImageLayer(context, layer, input.dpi, offsetXmm);
    else drawShape(context, layer, input.dpi, offsetXmm);
  }
  return {
    title: input.group.title,
    widthMm,
    heightMm,
    widthPx: canvas.width,
    heightPx: canvas.height,
    widthPt: pt(widthMm),
    heightPt: pt(heightMm),
    canvas,
    canvasToJpeg: async () => canvasBlob(canvas, 'image/jpeg', 0.92),
    canvasToPng: async () => canvasBlob(canvas, 'image/png'),
  };
}

export function pageGroupsForExport(document: CanvasDocument): CanvasPageGroup[] {
  return getPageGroups(document.pages);
}
