import { Ellipse, Rect, type FabricObject } from 'fabric';

import type { CanvasObjectSnapshot } from '../model/canvas-document';
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
  vakhaRole?: 'content' | 'decoration';
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

  const object: VakhaFabricObject =
    snapshot.kind === 'circle'
      ? new Ellipse({
          ...sharedOptions,
          rx: millimetersToLogicalPixels(snapshot.widthMm) / 2,
          ry: millimetersToLogicalPixels(snapshot.heightMm) / 2,
        })
      : new Rect({
          ...sharedOptions,
          width: millimetersToLogicalPixels(snapshot.widthMm),
          height: millimetersToLogicalPixels(snapshot.heightMm),
          rx: 8,
          ry: 8,
        });

  object.vakhaId = snapshot.id;
  object.vakhaName = snapshot.name;
  object.vakhaPageId = snapshot.pageId;
  object.vakhaParentId = snapshot.parentId;
  object.vakhaZIndex = snapshot.zIndex;
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

  if (object instanceof Ellipse) {
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
  const kind = object instanceof Ellipse ? 'circle' : 'rect';

  return {
    id: object.vakhaId ?? crypto.randomUUID(),
    pageId: object.vakhaPageId ?? 'unknown-page',
    parentId: object.vakhaParentId,
    name: object.vakhaName ?? 'Объект',
    kind,
    visible: object.visible,
    locked: !object.selectable,
    zIndex: object.vakhaZIndex ?? 0,
    xMm: roundMillimeters(logicalPixelsToMillimeters(object.left ?? 0) - pageOffsetMm),
    yMm: roundMillimeters(logicalPixelsToMillimeters(object.top ?? 0)),
    widthMm: Math.max(
      0.1,
      roundMillimeters(
        logicalPixelsToMillimeters((object.width ?? 0) * Math.abs(object.scaleX ?? 1)),
      ),
    ),
    heightMm: Math.max(
      0.1,
      roundMillimeters(
        logicalPixelsToMillimeters((object.height ?? 0) * Math.abs(object.scaleY ?? 1)),
      ),
    ),
    rotationDeg: roundMillimeters(object.angle ?? 0),
    fill: typeof object.fill === 'string' ? object.fill : '#7657e8',
    stroke: typeof object.stroke === 'string' ? object.stroke : '#ffffff',
    strokeWidthMm: roundMillimeters(logicalPixelsToMillimeters(object.strokeWidth ?? 0)),
    opacity: object.opacity,
  };
}
