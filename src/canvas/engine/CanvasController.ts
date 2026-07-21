import { Canvas, Point, type FabricObject } from 'fabric';

import { HistoryManager, type HistoryState } from '../history/HistoryManager';
import {
  createDefaultCanvasDocument,
  getSpreadWidthMm,
  type CanvasDocument,
  type CanvasObjectSnapshot,
} from '../model/canvas-document';
import {
  applySnapshotToFabricObject,
  createFabricObject,
  fabricObjectToSnapshot,
  type VakhaFabricObject,
} from '../objects/layer-object.factory';
import { createGridDecorations, createPageDecorations } from '../rendering/scene-decorations';
import { clamp, millimetersToLogicalPixels } from '../../utils/dimensions';

export type CanvasTool = 'select' | 'pan';

export interface CanvasControllerState extends HistoryState {
  zoom: number;
  viewportX: number;
  viewportY: number;
  selected?: CanvasObjectSnapshot;
}

interface CanvasControllerOptions {
  document: CanvasDocument;
  onDocumentChange: (document: CanvasDocument) => void;
  onStateChange: (state: CanvasControllerState) => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

export class CanvasController {
  private readonly canvas: Canvas;
  private document: CanvasDocument;
  private readonly history: HistoryManager;
  private readonly onDocumentChange: CanvasControllerOptions['onDocumentChange'];
  private readonly onStateChange: CanvasControllerOptions['onStateChange'];
  private gridObjects: FabricObject[] = [];
  private activeTransformBefore?: CanvasObjectSnapshot;
  private tool: CanvasTool = 'select';
  private spacePressed = false;
  private draggingViewport = false;
  private lastPointer = new Point(0, 0);
  private snappingEnabled = true;
  private hasFitted = false;

  constructor(element: HTMLCanvasElement, options: CanvasControllerOptions) {
    this.document = options.document;
    this.onDocumentChange = options.onDocumentChange;
    this.onStateChange = options.onStateChange;
    this.history = new HistoryManager(100, () => this.emitState());
    this.canvas = new Canvas(element, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: '#191d24',
      enableRetinaScaling: true,
      controlsAboveOverlay: true,
    });

    this.buildScene();
    this.bindCanvasEvents();
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.emitState();
  }

  resize(width: number, height: number): void {
    this.canvas.setDimensions({ width: Math.max(1, width), height: Math.max(1, height) });
    if (!this.hasFitted) {
      this.fitToViewport();
      this.hasFitted = true;
    } else {
      this.canvas.requestRenderAll();
    }
  }

  setTool(tool: CanvasTool): void {
    this.tool = tool;
    this.setContentInteraction(tool === 'select');
    this.canvas.defaultCursor = tool === 'pan' ? 'grab' : 'default';
    if (tool === 'pan') this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.emitState();
  }

  setGridVisible(visible: boolean): void {
    this.gridObjects.forEach((object) => object.set({ visible }));
    this.canvas.requestRenderAll();
  }

  setSnapping(enabled: boolean): void {
    this.snappingEnabled = enabled;
  }

  zoomIn(): void {
    this.setZoom(this.canvas.getZoom() * 1.15);
  }

  zoomOut(): void {
    this.setZoom(this.canvas.getZoom() / 1.15);
  }

  fitToViewport(): void {
    const spreadWidth = millimetersToLogicalPixels(getSpreadWidthMm(this.document.page));
    const pageHeight = millimetersToLogicalPixels(this.document.page.heightMm);
    const availableWidth = Math.max(100, this.canvas.getWidth() - 96);
    const availableHeight = Math.max(100, this.canvas.getHeight() - 72);
    const zoom = clamp(
      Math.min(availableWidth / spreadWidth, availableHeight / pageHeight),
      MIN_ZOOM,
      1.4,
    );
    const offsetX = (this.canvas.getWidth() - spreadWidth * zoom) / 2;
    const offsetY = (this.canvas.getHeight() - pageHeight * zoom) / 2;
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, offsetX, offsetY]);
    this.canvas.requestRenderAll();
    this.emitState();
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  nudgeSelected(deltaXmm: number, deltaYmm: number): void {
    const object = this.getSelectedContentObject();
    if (!object) return;
    const before = fabricObjectToSnapshot(object);
    object.set({
      left: (object.left ?? 0) + millimetersToLogicalPixels(deltaXmm),
      top: (object.top ?? 0) + millimetersToLogicalPixels(deltaYmm),
    });
    object.setCoords();
    const after = fabricObjectToSnapshot(object);
    this.recordObjectChange(object, before, after, 'Перемещение объекта');
  }

  resetToDefault(): void {
    const replacement = createDefaultCanvasDocument(this.document.projectId);
    this.document = replacement;
    this.canvas.clear();
    this.canvas.backgroundColor = '#191d24';
    this.buildScene();
    this.history.clear();
    this.fitToViewport();
    this.notifyDocumentChanged();
  }

  getDocument(): CanvasDocument {
    return this.serializeDocument();
  }

  async dispose(): Promise<void> {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    await this.canvas.dispose();
  }

  private buildScene(): void {
    createPageDecorations(this.document.page).forEach((object) => this.canvas.add(object));
    this.gridObjects = createGridDecorations(this.document.page);
    this.gridObjects.forEach((object) => this.canvas.add(object));
    this.document.objects.forEach((snapshot) => this.canvas.add(createFabricObject(snapshot)));
    this.canvas.requestRenderAll();
  }

  private bindCanvasEvents(): void {
    this.canvas.on('before:transform', ({ transform }) => {
      const target = transform.target as VakhaFabricObject;
      if (target.vakhaRole === 'content')
        this.activeTransformBefore = fabricObjectToSnapshot(target);
    });

    this.canvas.on('object:moving', ({ target }) => {
      if (!this.snappingEnabled || (target as VakhaFabricObject).vakhaRole !== 'content') return;
      const step = millimetersToLogicalPixels(this.document.page.gridStepMm);
      target.set({
        left: Math.round((target.left ?? 0) / step) * step,
        top: Math.round((target.top ?? 0) / step) * step,
      });
    });

    this.canvas.on('object:modified', ({ target, action }) => {
      const object = target as VakhaFabricObject;
      if (object.vakhaRole !== 'content') return;
      const before = this.activeTransformBefore;
      const after = fabricObjectToSnapshot(object);
      this.activeTransformBefore = undefined;
      if (before && JSON.stringify(before) !== JSON.stringify(after)) {
        this.recordObjectChange(object, before, after, this.getActionLabel(action));
      }
    });

    const updateSelection = () => this.emitState();
    this.canvas.on('selection:created', updateSelection);
    this.canvas.on('selection:updated', updateSelection);
    this.canvas.on('selection:cleared', updateSelection);

    this.canvas.on('mouse:wheel', ({ e }) => {
      e.preventDefault();
      e.stopPropagation();
      const zoom = clamp(this.canvas.getZoom() * Math.pow(0.999, e.deltaY), MIN_ZOOM, MAX_ZOOM);
      this.canvas.zoomToPoint(this.canvas.getViewportPoint(e), zoom);
      this.canvas.requestRenderAll();
      this.emitState();
    });

    this.canvas.on('mouse:down', ({ e }) => {
      if (this.tool !== 'pan' && !this.spacePressed) return;
      this.draggingViewport = true;
      this.lastPointer = this.canvas.getViewportPoint(e);
      this.canvas.selection = false;
      this.canvas.defaultCursor = 'grabbing';
    });

    this.canvas.on('mouse:move', ({ e }) => {
      if (!this.draggingViewport) return;
      const pointer = this.canvas.getViewportPoint(e);
      const transform = [...this.canvas.viewportTransform] as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      transform[4] += pointer.x - this.lastPointer.x;
      transform[5] += pointer.y - this.lastPointer.y;
      this.canvas.setViewportTransform(transform);
      this.lastPointer = pointer;
      this.canvas.requestRenderAll();
    });

    this.canvas.on('mouse:up', () => {
      if (!this.draggingViewport) return;
      this.draggingViewport = false;
      this.setContentInteraction(this.tool === 'select' && !this.spacePressed);
      this.canvas.defaultCursor = this.tool === 'pan' ? 'grab' : 'default';
    });
  }

  private setZoom(value: number): void {
    const zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    const center = new Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2);
    this.canvas.zoomToPoint(center, zoom);
    this.canvas.requestRenderAll();
    this.emitState();
  }

  private recordObjectChange(
    object: VakhaFabricObject,
    before: CanvasObjectSnapshot,
    after: CanvasObjectSnapshot,
    label: string,
  ): void {
    const apply = (snapshot: CanvasObjectSnapshot) => {
      applySnapshotToFabricObject(object, snapshot);
      this.canvas.setActiveObject(object);
      this.canvas.requestRenderAll();
      this.notifyDocumentChanged();
    };

    this.history.record({
      label,
      undo: () => apply(before),
      redo: () => apply(after),
    });
    this.canvas.requestRenderAll();
    this.notifyDocumentChanged();
  }

  private notifyDocumentChanged(): void {
    this.document = this.serializeDocument();
    this.onDocumentChange(this.document);
    this.emitState();
  }

  private serializeDocument(): CanvasDocument {
    return {
      ...this.document,
      objects: this.canvas
        .getObjects()
        .filter((object) => (object as VakhaFabricObject).vakhaRole === 'content')
        .map((object) => fabricObjectToSnapshot(object as VakhaFabricObject)),
      updatedAt: new Date().toISOString(),
    };
  }

  private getSelectedContentObject(): VakhaFabricObject | undefined {
    const selected = this.canvas.getActiveObjects();
    if (selected.length !== 1) return undefined;
    const object = selected[0] as VakhaFabricObject;
    return object.vakhaRole === 'content' ? object : undefined;
  }

  private emitState(): void {
    const selected = this.getSelectedContentObject();
    this.onStateChange({
      zoom: this.canvas.getZoom(),
      viewportX: this.canvas.viewportTransform[4],
      viewportY: this.canvas.viewportTransform[5],
      selected: selected ? fabricObjectToSnapshot(selected) : undefined,
      ...this.history.getState(),
    });
  }

  private setContentInteraction(enabled: boolean): void {
    this.canvas.selection = enabled;
    this.canvas.getObjects().forEach((object) => {
      if ((object as VakhaFabricObject).vakhaRole === 'content') {
        object.selectable = enabled;
        object.evented = enabled;
      }
    });
  }

  private getActionLabel(action?: string): string {
    if (action?.includes('rotate')) return 'Поворот объекта';
    if (action?.includes('scale') || action?.includes('resize')) return 'Изменение размера';
    return 'Перемещение объекта';
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, [contenteditable="true"]')) return;

    if (event.code === 'Space') {
      this.spacePressed = true;
      this.setContentInteraction(false);
      this.canvas.defaultCursor = 'grab';
      event.preventDefault();
      return;
    }

    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (modifier && event.key === '0') {
      event.preventDefault();
      this.fitToViewport();
      return;
    }
    if (modifier && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.zoomIn();
      return;
    }
    if (modifier && event.key === '-') {
      event.preventDefault();
      this.zoomOut();
      return;
    }

    const step = event.shiftKey ? 10 : 1;
    const nudges: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const nudge = nudges[event.key];
    if (nudge) {
      event.preventDefault();
      this.nudgeSelected(...nudge);
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code !== 'Space') return;
    this.spacePressed = false;
    if (!this.draggingViewport) {
      this.setContentInteraction(this.tool === 'select');
      this.canvas.defaultCursor = this.tool === 'pan' ? 'grab' : 'default';
    }
  };
}
