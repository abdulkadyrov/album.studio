import { Ellipse, Rect, Shadow, Textbox, type FabricObject } from 'fabric';

import type { CanvasObjectSnapshot, CanvasTextStyle } from '../model/canvas-document';
import { applyTextCase, resolveTextOverflow } from '../text/text-layout';
import {
  logicalPixelsToMillimeters,
  millimetersToLogicalPixels,
  roundMillimeters,
} from '../../utils/dimensions';

export type VakhaFabricObject = FabricObject & {
  vakhaId?: string;
  vakhaName?: string;
  vakhaPageId?: string;
  vakhaParentId?: string;
  vakhaZIndex?: number;
  vakhaLocked?: boolean;
  vakhaRole?: 'content' | 'decoration';
  vakhaText?: CanvasTextStyle;
  vakhaTextWidthMm?: number;
  vakhaTextHeightMm?: number;
  vakhaTextOverflow?: boolean;
};

const selectionStyle = {
  borderColor: '#7657e8',
  borderScaleFactor: 1.5,
  cornerColor: '#f7f5ff',
  cornerStrokeColor: '#7657e8',
  cornerSize: 9,
  transparentCorners: false,
  padding: 2,
} as const;

function pointsToLogicalPixels(points: number): number {
  return millimetersToLogicalPixels((points / 72) * 25.4);
}

function withOpacity(color: string, opacity: number): string {
  if (/^#[\da-f]{6}$/i.test(color)) {
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${alpha}`;
  }
  return color;
}

function createShadow(text: CanvasTextStyle): Shadow | undefined {
  if (!text.shadow.enabled) return undefined;
  return new Shadow({
    color: withOpacity(text.shadow.color, text.shadow.opacity),
    blur: text.shadow.blur,
    offsetX: millimetersToLogicalPixels(text.shadow.offsetXmm),
    offsetY: millimetersToLogicalPixels(text.shadow.offsetYmm),
  });
}

function configureTextObject(
  object: Textbox & VakhaFabricObject,
  snapshot: CanvasObjectSnapshot,
): void {
  const text = snapshot.text!;
  const boxWidth = millimetersToLogicalPixels(snapshot.widthMm);
  const boxHeight = millimetersToLogicalPixels(snapshot.heightMm);
  object.set({
    text: applyTextCase(text.content, text.textCase),
    width: Math.max(1, boxWidth - millimetersToLogicalPixels(text.paddingMm) * 2),
    fontFamily: text.fontFamily,
    fontSize: pointsToLogicalPixels(text.fontSizePt),
    fontWeight: text.fontWeight,
    fontStyle: text.fontStyle,
    underline: text.underline,
    linethrough: text.linethrough,
    textAlign: text.textAlign,
    charSpacing: text.letterSpacingEm * 1000,
    lineHeight: text.lineHeight,
    direction: text.direction,
    padding: millimetersToLogicalPixels(text.paddingMm),
    shadow: createShadow(text),
    splitByGrapheme: false,
  });
  object.initDimensions();
  let measuredHeight = object.height;
  const initialLineCount = object.textLines.length;
  const overflow = resolveTextOverflow({
    mode: text.overflowMode,
    fontSizePt: text.fontSizePt,
    minFontSizePt: text.minFontSizePt,
    measuredHeightMm: logicalPixelsToMillimeters(measuredHeight),
    availableHeightMm: snapshot.heightMm - text.paddingMm * 2,
    lineCount: initialLineCount,
    maxLines: text.maxLines,
  });
  if (overflow.appliedFontSizePt !== text.fontSizePt) {
    object.set({ fontSize: pointsToLogicalPixels(overflow.appliedFontSizePt) });
    object.initDimensions();
    measuredHeight = object.height;
  }
  const renderedHeight =
    text.boxMode === 'auto'
      ? measuredHeight + millimetersToLogicalPixels(text.paddingMm) * 2
      : boxHeight;
  object.set({ height: renderedHeight });
  if (overflow.clipped) {
    object.clipPath = new Rect({
      width: boxWidth,
      height: boxHeight,
      originX: 'center',
      originY: 'center',
    });
  } else {
    object.clipPath = undefined;
  }
  const freeSpace = Math.max(0, renderedHeight - measuredHeight);
  const verticalOffset =
    text.verticalAlign === 'middle'
      ? freeSpace / 2
      : text.verticalAlign === 'bottom'
        ? freeSpace
        : 0;
  const textObject = object as Textbox & { _getTopOffset: () => number };
  textObject._getTopOffset = () => -renderedHeight / 2 + verticalOffset;
  object.vakhaText = structuredClone(text);
  object.vakhaTextWidthMm = snapshot.widthMm;
  object.vakhaTextHeightMm =
    text.boxMode === 'auto' ? logicalPixelsToMillimeters(renderedHeight) : snapshot.heightMm;
  object.vakhaTextOverflow =
    measuredHeight > boxHeight - millimetersToLogicalPixels(text.paddingMm) * 2 + 0.5 ||
    Boolean(text.maxLines && object.textLines.length > text.maxLines) ||
    overflow.belowMinimum;
  object.setCoords();
}

export function createFabricObject(
  snapshot: CanvasObjectSnapshot,
  pageOffsetMm = 0,
): VakhaFabricObject {
  if (snapshot.kind === 'group') throw new TypeError('Группа не является объектом Fabric');
  const sharedOptions = {
    left: millimetersToLogicalPixels(snapshot.xMm + pageOffsetMm),
    top: millimetersToLogicalPixels(snapshot.yMm),
    angle: snapshot.rotationDeg,
    fill: snapshot.fill,
    stroke: snapshot.stroke,
    strokeWidth: millimetersToLogicalPixels(snapshot.strokeWidthMm),
    opacity: snapshot.opacity,
    originX: 'left' as const,
    originY: 'top' as const,
    lockSkewingX: true,
    lockSkewingY: true,
    visible: snapshot.visible,
    selectable: !snapshot.locked,
    evented: !snapshot.locked,
    ...selectionStyle,
  };

  let object: VakhaFabricObject;
  if (snapshot.kind === 'text') {
    const textbox = new Textbox('', {
      ...sharedOptions,
      editable: true,
      width: millimetersToLogicalPixels(snapshot.widthMm),
    }) as Textbox & VakhaFabricObject;
    configureTextObject(textbox, snapshot);
    object = textbox;
  } else if (snapshot.kind === 'circle') {
    object = new Ellipse({
      ...sharedOptions,
      rx: millimetersToLogicalPixels(snapshot.widthMm) / 2,
      ry: millimetersToLogicalPixels(snapshot.heightMm) / 2,
    });
  } else {
    object = new Rect({
      ...sharedOptions,
      width: millimetersToLogicalPixels(snapshot.widthMm),
      height: millimetersToLogicalPixels(snapshot.heightMm),
      rx: 8,
      ry: 8,
    });
  }

  object.vakhaId = snapshot.id;
  object.vakhaName = snapshot.name;
  object.vakhaPageId = snapshot.pageId;
  object.vakhaParentId = snapshot.parentId;
  object.vakhaZIndex = snapshot.zIndex;
  object.vakhaLocked = snapshot.locked;
  object.vakhaRole = 'content';
  return object;
}

export function applySnapshotToFabricObject(
  object: VakhaFabricObject,
  snapshot: CanvasObjectSnapshot,
  pageOffsetMm = 0,
): void {
  const width = millimetersToLogicalPixels(snapshot.widthMm);
  const height = millimetersToLogicalPixels(snapshot.heightMm);

  object.set({
    left: millimetersToLogicalPixels(snapshot.xMm + pageOffsetMm),
    top: millimetersToLogicalPixels(snapshot.yMm),
    angle: snapshot.rotationDeg,
    fill: snapshot.fill,
    stroke: snapshot.stroke,
    strokeWidth: millimetersToLogicalPixels(snapshot.strokeWidthMm),
    opacity: snapshot.opacity,
    scaleX: 1,
    scaleY: 1,
    visible: snapshot.visible,
    selectable: !snapshot.locked,
    evented: !snapshot.locked,
  });

  object.vakhaName = snapshot.name;
  object.vakhaParentId = snapshot.parentId;
  object.vakhaZIndex = snapshot.zIndex;
  object.vakhaLocked = snapshot.locked;

  if (object instanceof Textbox && snapshot.kind === 'text') {
    configureTextObject(object as Textbox & VakhaFabricObject, snapshot);
  } else if (object instanceof Ellipse) {
    object.set({ rx: width / 2, ry: height / 2 });
  } else {
    object.set({ width, height });
  }

  object.setCoords();
}

export function fabricObjectToSnapshot(
  object: VakhaFabricObject,
  pageOffsetMm = 0,
): CanvasObjectSnapshot {
  const kind = object instanceof Textbox ? 'text' : object instanceof Ellipse ? 'circle' : 'rect';
  const widthMm =
    object instanceof Textbox
      ? (object.vakhaTextWidthMm ?? logicalPixelsToMillimeters(object.width)) *
        Math.abs(object.scaleX ?? 1)
      : logicalPixelsToMillimeters((object.width ?? 0) * Math.abs(object.scaleX ?? 1));
  const heightMm =
    object instanceof Textbox
      ? (object.vakhaTextHeightMm ?? logicalPixelsToMillimeters(object.height)) *
        Math.abs(object.scaleY ?? 1)
      : logicalPixelsToMillimeters((object.height ?? 0) * Math.abs(object.scaleY ?? 1));
  const textStyle = object instanceof Textbox ? (object as VakhaFabricObject).vakhaText : undefined;

  return {
    id: object.vakhaId ?? crypto.randomUUID(),
    pageId: object.vakhaPageId ?? 'unknown-page',
    parentId: object.vakhaParentId,
    name: object.vakhaName ?? 'Объект',
    kind,
    visible: object.visible,
    locked: object.vakhaLocked ?? false,
    zIndex: object.vakhaZIndex ?? 0,
    xMm: roundMillimeters(logicalPixelsToMillimeters(object.left ?? 0) - pageOffsetMm),
    yMm: roundMillimeters(logicalPixelsToMillimeters(object.top ?? 0)),
    widthMm: Math.max(0.1, roundMillimeters(widthMm)),
    heightMm: Math.max(0.1, roundMillimeters(heightMm)),
    rotationDeg: roundMillimeters(object.angle ?? 0),
    fill: typeof object.fill === 'string' ? object.fill : '#7657e8',
    stroke: typeof object.stroke === 'string' ? object.stroke : '#ffffff',
    strokeWidthMm: roundMillimeters(logicalPixelsToMillimeters(object.strokeWidth ?? 0)),
    opacity: object.opacity,
    text: textStyle ? structuredClone(textStyle) : undefined,
  };
}

export function updateFabricTextContent(
  object: Textbox & VakhaFabricObject,
  content: string,
): void {
  if (!object.vakhaText) return;
  object.vakhaText = { ...object.vakhaText, content };
}
