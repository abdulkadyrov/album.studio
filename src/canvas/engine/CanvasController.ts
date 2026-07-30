import { ActiveSelection, Canvas, Point, type FabricObject, type Textbox } from 'fabric';

import { HistoryManager, type HistoryState } from '../history/HistoryManager';
import {
  createDefaultCanvasDocument,
  createDefaultImageStyle,
  createDefaultTextStyle,
  getActivePageGroup,
  getPageLayout,
  getSpreadWidthMm,
  normalizeDocumentOrder,
  type CanvasDocument,
  type CanvasImageStyle,
  type CanvasLayerSnapshot,
  type CanvasTextStyle,
} from '../model/canvas-document';
import {
  applySnapshotToFabricObject,
  createFabricObject,
  fabricObjectToSnapshot,
  updateFabricTextContent,
  type VakhaFabricObject,
} from '../objects/layer-object.factory';
import { createGridDecorations, createPageDecorations } from '../rendering/scene-decorations';
import { clamp, millimetersToLogicalPixels } from '../../utils/dimensions';

export type CanvasTool = 'select' | 'pan';

export interface CanvasControllerState extends HistoryState {
  zoom: number;
  viewportX: number;
  viewportY: number;
  selected?: CanvasLayerSnapshot;
  selectedIds: string[];
  layers: CanvasLayerSnapshot[];
  textIssues: Record<string, { overflow: boolean; missingFont: boolean }>;
  imageIssues: Record<
    string,
    { effectiveDpi: number; lowQuality: boolean; missing: boolean; missingMask: boolean }
  >;
}

export interface TextLayerUpdate {
  text?: Partial<CanvasTextStyle> & { shadow?: Partial<CanvasTextStyle['shadow']> };
  fill?: string;
  opacity?: number;
  stroke?: string;
  strokeWidthMm?: number;
  rotationDeg?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface ImageLayerUpdate {
  image?: Partial<CanvasImageStyle> & {
    effects?: Partial<CanvasImageStyle['effects']>;
    shadow?: Partial<CanvasImageStyle['shadow']>;
  };
  opacity?: number;
  stroke?: string;
  strokeWidthMm?: number;
  rotationDeg?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface NewImageAsset {
  id: string;
  thumbnailId?: string;
  filename: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
}

interface CanvasControllerOptions {
  document: CanvasDocument;
  activePageId: string;
  onDocumentChange: (document: CanvasDocument) => void;
  onStateChange: (state: CanvasControllerState) => void;
  onFrameReplaceRequest?: (layerId: string) => void;
  isFontAvailable?: (family: string, assetId?: string) => boolean;
  getImageElement?: (assetId: string) => HTMLImageElement | undefined;
}

type FabricTransformCanvas = Canvas & {
  _currentTransform?: unknown;
  endCurrentTransform: (event: Event) => void;
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const MAX_GROUP_DEPTH = 3;

export class CanvasController {
  private readonly canvas: Canvas;
  private document: CanvasDocument;
  private activePageId: string;
  private readonly history: HistoryManager;
  private readonly onDocumentChange: CanvasControllerOptions['onDocumentChange'];
  private readonly onStateChange: CanvasControllerOptions['onStateChange'];
  private readonly onFrameReplaceRequest: CanvasControllerOptions['onFrameReplaceRequest'];
  private gridObjects: FabricObject[] = [];
  private activeTransformBefore?: CanvasLayerSnapshot;
  private tool: CanvasTool = 'select';
  private spacePressed = false;
  private draggingViewport = false;
  private lastPointer = new Point(0, 0);
  private snappingEnabled = true;
  private gridVisible = true;
  private hasFitted = false;
  private suspendSelectionState = false;
  private textEditingBefore?: CanvasLayerSnapshot;
  private ignoreTextModified = false;
  private readonly isFontAvailable: NonNullable<CanvasControllerOptions['isFontAvailable']>;
  private readonly getImageElement: NonNullable<CanvasControllerOptions['getImageElement']>;

  constructor(element: HTMLCanvasElement, options: CanvasControllerOptions) {
    this.document = options.document;
    this.activePageId = options.activePageId;
    this.onDocumentChange = options.onDocumentChange;
    this.onStateChange = options.onStateChange;
    this.onFrameReplaceRequest = options.onFrameReplaceRequest;
    this.isFontAvailable = options.isFontAvailable ?? (() => true);
    this.getImageElement = options.getImageElement ?? (() => undefined);
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
    window.addEventListener('mousedown', this.releaseStaleTransformBeforePointerDown, true);
    window.addEventListener('pointerdown', this.releaseStaleTransformBeforePointerDown, true);
    window.addEventListener('touchstart', this.releaseStaleTransformBeforePointerDown, true);
    window.addEventListener('mouseup', this.releasePointerInteraction, true);
    window.addEventListener('pointerup', this.releasePointerInteraction, true);
    window.addEventListener('pointercancel', this.releasePointerInteraction, true);
    window.addEventListener('touchend', this.releasePointerInteraction, true);
    window.addEventListener('touchcancel', this.releasePointerInteraction, true);
    window.addEventListener('mousemove', this.handleReleasedPointerMove, true);
    window.addEventListener('pointermove', this.handleReleasedPointerMove, true);
    window.addEventListener('blur', this.releasePointerInteraction);
    window.addEventListener('pagehide', this.releasePointerInteraction);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
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

  loadDocument(document: CanvasDocument, activePageId: string): void {
    this.document = normalizeDocumentOrder(document);
    this.activePageId = activePageId;
    this.canvas.clear();
    this.canvas.backgroundColor = '#191d24';
    this.buildScene();
    this.history.clear();
    this.fitToViewport();
  }

  setTool(tool: CanvasTool): void {
    this.releasePointerInteraction(new Event('toolchange'));
    this.tool = tool;
    this.setContentInteraction(tool === 'select');
    this.canvas.defaultCursor = tool === 'pan' ? 'grab' : 'default';
    if (tool === 'pan') this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.emitState();
  }

  confirmSelection(): void {
    this.releasePointerInteraction(new Event('confirmselection'));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.emitState([]);
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
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
    const layout = getPageLayout(getActivePageGroup(this.document, this.activePageId));
    const spreadWidth = millimetersToLogicalPixels(getSpreadWidthMm(layout));
    const pageHeight = millimetersToLogicalPixels(layout.heightMm);
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

  addTextLayer(): void {
    const group = getActivePageGroup(this.document, this.activePageId);
    const page =
      group.pages.find((candidate) => candidate.id === this.activePageId) ?? group.pages[0]!;
    const layer: CanvasLayerSnapshot = {
      id: this.newId('text'),
      pageId: page.id,
      name: 'Текстовый слой',
      kind: 'text',
      visible: true,
      locked: false,
      zIndex: this.document.layers.filter((candidate) => candidate.pageId === page.id).length,
      xMm: 35,
      yMm: 35,
      widthMm: 130,
      heightMm: 42,
      rotationDeg: 0,
      fill: '#202737',
      stroke: 'transparent',
      strokeWidthMm: 0,
      opacity: 1,
      text: createDefaultTextStyle(),
    };
    this.updateDocument('Добавление текста', (document) => ({
      ...document,
      layers: [...document.layers, layer],
    }));
    this.selectLayers([layer.id]);
  }

  addImageLayer(
    asset: NewImageAsset,
    kind: 'image' | 'frame' | 'decoration' | 'background' = 'image',
  ): void {
    const group = getActivePageGroup(this.document, this.activePageId);
    const page =
      group.pages.find((candidate) => candidate.id === this.activePageId) ?? group.pages[0]!;
    const widthMm = kind === 'background' ? page.widthMm : kind === 'decoration' ? 70 : 90;
    const heightMm = Math.max(30, widthMm * (asset.heightPx / asset.widthPx));
    const layer: CanvasLayerSnapshot = {
      id: this.newId(kind),
      pageId: page.id,
      name:
        kind === 'frame'
          ? 'Фоторамка'
          : kind === 'decoration'
            ? 'Декор'
            : kind === 'background'
              ? 'Фон страницы'
              : asset.filename,
      kind,
      visible: true,
      locked: false,
      zIndex:
        kind === 'background'
          ? 0
          : this.document.layers.filter((candidate) => candidate.pageId === page.id).length,
      xMm: kind === 'background' ? 0 : 35,
      yMm: kind === 'background' ? 0 : 35,
      widthMm,
      heightMm: kind === 'background' ? page.heightMm : Math.min(130, heightMm),
      rotationDeg: 0,
      fill: 'transparent',
      stroke: kind === 'frame' ? '#ffffff' : 'transparent',
      strokeWidthMm: kind === 'frame' ? 1 : 0,
      opacity: 1,
      image: createDefaultImageStyle({
        assetId: asset.id,
        thumbnailAssetId: asset.thumbnailId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        naturalWidthPx: asset.widthPx,
        naturalHeightPx: asset.heightPx,
      }),
    };
    if (kind === 'frame') layer.image!.frameShape = 'rounded';
    this.updateDocument(
      kind === 'frame' ? 'Добавление фоторамки' : 'Добавление изображения',
      (document) => ({
        ...document,
        layers: kind === 'background' ? [layer, ...document.layers] : [...document.layers, layer],
      }),
    );
    this.selectLayers([layer.id]);
  }

  addShapeLayer(kind: 'rect' | 'circle' = 'rect'): void {
    const page = getActivePageGroup(this.document, this.activePageId).pages[0]!;
    const layer: CanvasLayerSnapshot = {
      id: this.newId('shape'),
      pageId: page.id,
      name: kind === 'circle' ? 'Круг' : 'Фигура',
      kind,
      visible: true,
      locked: false,
      zIndex: this.document.layers.filter((candidate) => candidate.pageId === page.id).length,
      xMm: 50,
      yMm: 50,
      widthMm: 55,
      heightMm: kind === 'circle' ? 55 : 40,
      rotationDeg: 0,
      fill: '#7657e8',
      stroke: '#ffffff',
      strokeWidthMm: 0.5,
      opacity: 1,
    };
    this.updateDocument('Добавление фигуры', (document) => ({
      ...document,
      layers: [...document.layers, layer],
    }));
    this.selectLayers([layer.id]);
  }

  updateImageLayer(layerId: string, patch: ImageLayerUpdate): void {
    const current = this.getLayer(layerId);
    if (!current?.image) return;
    this.updateDocument('Изменение изображения', (document) => ({
      ...document,
      layers: document.layers.map((layer) => {
        if (layer.id !== layerId || !layer.image) return layer;
        return {
          ...layer,
          ...patch,
          image: patch.image
            ? {
                ...layer.image,
                ...patch.image,
                effects: patch.image.effects
                  ? { ...layer.image.effects, ...patch.image.effects }
                  : layer.image.effects,
                shadow: patch.image.shadow
                  ? { ...layer.image.shadow, ...patch.image.shadow }
                  : layer.image.shadow,
              }
            : layer.image,
        };
      }),
    }));
    this.selectLayers([layerId]);
  }

  refreshImages(): void {
    const selectedIds = this.canvas
      .getActiveObjects()
      .flatMap((object) => (object as VakhaFabricObject).vakhaId ?? []);
    this.document = this.serializeDocument();
    this.rebuildScene(selectedIds);
  }

  updateTextLayer(layerId: string, patch: TextLayerUpdate): void {
    const current = this.getLayer(layerId);
    if (!current?.text) return;
    this.updateDocument('Изменение текста', (document) => ({
      ...document,
      layers: document.layers.map((layer) => {
        if (layer.id !== layerId || !layer.text) return layer;
        const nextText = patch.text
          ? {
              ...layer.text,
              ...patch.text,
              shadow: patch.text.shadow
                ? { ...layer.text.shadow, ...patch.text.shadow }
                : layer.text.shadow,
            }
          : layer.text;
        return {
          ...layer,
          ...patch,
          text: nextText,
        };
      }),
    }));
    this.selectLayers([layerId]);
  }

  refreshFonts(): void {
    const selectedIds = this.canvas
      .getActiveObjects()
      .flatMap((object) => (object as VakhaFabricObject).vakhaId ?? []);
    this.document = this.serializeDocument();
    this.rebuildScene(selectedIds);
  }

  selectLayers(layerIds: string[]): void {
    const expandedIds = new Set(layerIds.flatMap((id) => this.getRenderableDescendantIds(id)));
    const objects = this.canvas
      .getObjects()
      .filter((object) => expandedIds.has((object as VakhaFabricObject).vakhaId ?? ''));
    this.canvas.discardActiveObject();
    if (objects.length === 1) this.canvas.setActiveObject(objects[0]!);
    if (objects.length > 1) {
      const selection = new ActiveSelection(objects, { canvas: this.canvas });
      this.configureActiveSelection(selection);
      this.canvas.setActiveObject(selection);
    }
    this.canvas.requestRenderAll();
    this.emitState(layerIds);
  }

  renameLayer(layerId: string, name: string): void {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    this.updateDocument('Переименование слоя', (document) => ({
      ...document,
      layers: document.layers.map((layer) =>
        layer.id === layerId ? { ...layer, name: trimmedName } : layer,
      ),
    }));
  }

  toggleLayerVisibility(layerId: string): void {
    const affectedIds = new Set([layerId, ...this.getDescendantIds(layerId)]);
    this.updateDocument('Видимость слоя', (document) => ({
      ...document,
      layers: document.layers.map((layer) =>
        affectedIds.has(layer.id) ? { ...layer, visible: !this.getLayer(layerId)?.visible } : layer,
      ),
    }));
  }

  toggleLayerLock(layerId: string): void {
    const affectedIds = new Set([layerId, ...this.getDescendantIds(layerId)]);
    this.updateDocument('Блокировка слоя', (document) => ({
      ...document,
      layers: document.layers.map((layer) =>
        affectedIds.has(layer.id) ? { ...layer, locked: !this.getLayer(layerId)?.locked } : layer,
      ),
    }));
  }

  duplicateLayer(layerId: string): void {
    const sourceIds = [layerId, ...this.getDescendantIds(layerId)];
    const sources = sourceIds.flatMap((id) => {
      const layer = this.getLayer(id);
      return layer ? [layer] : [];
    });
    if (sources.length === 0) return;
    const idMap = new Map(sources.map((layer) => [layer.id, this.newId('layer')]));
    const duplicates = sources.map((layer, index) => ({
      ...layer,
      id: idMap.get(layer.id)!,
      parentId: layer.parentId ? (idMap.get(layer.parentId) ?? layer.parentId) : undefined,
      name: index === 0 ? `${layer.name} — копия` : layer.name,
      xMm: layer.kind === 'group' ? layer.xMm : layer.xMm + 5,
      yMm: layer.kind === 'group' ? layer.yMm : layer.yMm + 5,
      zIndex: this.getActiveLayers().length + index,
    }));
    this.updateDocument('Дублирование слоя', (document) => ({
      ...document,
      layers: [...document.layers, ...duplicates],
    }));
    this.selectLayers([duplicates[0]!.id]);
  }

  deleteLayer(layerId: string): void {
    const deletedIds = new Set([layerId, ...this.getDescendantIds(layerId)]);
    this.updateDocument('Удаление слоя', (document) => ({
      ...document,
      layers: document.layers.filter((layer) => !deletedIds.has(layer.id)),
    }));
  }

  moveLayer(layerId: string, direction: -1 | 1): void {
    const layer = this.getLayer(layerId);
    if (!layer) return;
    const siblings = this.getActiveLayers()
      .filter(
        (candidate) => candidate.pageId === layer.pageId && candidate.parentId === layer.parentId,
      )
      .sort((left, right) => left.zIndex - right.zIndex);
    const index = siblings.findIndex((candidate) => candidate.id === layerId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const target = siblings[targetIndex]!;
    this.updateDocument(direction > 0 ? 'Поднять слой' : 'Опустить слой', (document) => ({
      ...document,
      layers: document.layers.map((candidate) => {
        if (candidate.id === layer.id) return { ...candidate, zIndex: target.zIndex };
        if (candidate.id === target.id) return { ...candidate, zIndex: layer.zIndex };
        return candidate;
      }),
    }));
    this.selectLayers([layerId]);
  }

  reorderLayer(layerId: string, targetLayerId: string): void {
    const layer = this.getLayer(layerId);
    const target = this.getLayer(targetLayerId);
    if (!layer || !target || layer.pageId !== target.pageId || layer.parentId !== target.parentId)
      return;
    const pageLayers = this.document.layers
      .filter((candidate) => candidate.pageId === layer.pageId)
      .sort((left, right) => left.zIndex - right.zIndex);
    const sourceIndex = pageLayers.findIndex((candidate) => candidate.id === layerId);
    const targetIndex = pageLayers.findIndex((candidate) => candidate.id === targetLayerId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [moved] = pageLayers.splice(sourceIndex, 1);
    pageLayers.splice(targetIndex, 0, moved!);
    const zIndexById = new Map(pageLayers.map((candidate, index) => [candidate.id, index]));
    this.updateDocument('Изменение порядка слоёв', (document) => ({
      ...document,
      layers: document.layers.map((candidate) => ({
        ...candidate,
        zIndex: zIndexById.get(candidate.id) ?? candidate.zIndex,
      })),
    }));
    this.selectLayers([layerId]);
  }

  groupLayers(layerIds: string[]): void {
    const layers = layerIds.flatMap((id) => {
      const layer = this.getLayer(id);
      return layer ? [layer] : [];
    });
    if (layers.length < 2 || new Set(layers.map((layer) => layer.pageId)).size !== 1) return;
    const parentId = layers[0]?.parentId;
    if (layers.some((layer) => layer.parentId !== parentId)) return;
    const depth = parentId ? this.getLayerDepth(parentId) + 1 : 1;
    if (depth > MAX_GROUP_DEPTH) return;
    const groupId = this.newId('group');
    const group: CanvasLayerSnapshot = {
      id: groupId,
      pageId: layers[0]!.pageId,
      parentId,
      name: 'Новая группа',
      kind: 'group',
      visible: true,
      locked: false,
      zIndex: Math.max(...layers.map((layer) => layer.zIndex)),
      xMm: 0,
      yMm: 0,
      widthMm: 1,
      heightMm: 1,
      rotationDeg: 0,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidthMm: 0,
      opacity: 1,
    };
    this.updateDocument('Группировка слоёв', (document) => ({
      ...document,
      layers: [
        ...document.layers.map((layer) =>
          layerIds.includes(layer.id) ? { ...layer, parentId: groupId } : layer,
        ),
        group,
      ],
    }));
    this.selectLayers([groupId]);
  }

  ungroupLayer(layerId: string): void {
    const group = this.getLayer(layerId);
    if (!group || group.kind !== 'group') return;
    this.updateDocument('Разгруппировка слоёв', (document) => ({
      ...document,
      layers: document.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer) =>
          layer.parentId === layerId ? { ...layer, parentId: group.parentId } : layer,
        ),
    }));
  }

  nudgeSelected(deltaXmm: number, deltaYmm: number): void {
    const object = this.getSelectedContentObject();
    if (!object) return;
    const before = this.snapshotObject(object);
    object.set({
      left: (object.left ?? 0) + millimetersToLogicalPixels(deltaXmm),
      top: (object.top ?? 0) + millimetersToLogicalPixels(deltaYmm),
    });
    object.setCoords();
    const after = this.snapshotObject(object);
    this.recordObjectChange(object, before, after, 'Перемещение объекта');
  }

  resetToDefault(): void {
    this.document = createDefaultCanvasDocument(this.document.projectId);
    this.activePageId = this.document.pages[0]!.id;
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
    window.removeEventListener('mousedown', this.releaseStaleTransformBeforePointerDown, true);
    window.removeEventListener('pointerdown', this.releaseStaleTransformBeforePointerDown, true);
    window.removeEventListener('touchstart', this.releaseStaleTransformBeforePointerDown, true);
    window.removeEventListener('mouseup', this.releasePointerInteraction, true);
    window.removeEventListener('pointerup', this.releasePointerInteraction, true);
    window.removeEventListener('pointercancel', this.releasePointerInteraction, true);
    window.removeEventListener('touchend', this.releasePointerInteraction, true);
    window.removeEventListener('touchcancel', this.releasePointerInteraction, true);
    window.removeEventListener('mousemove', this.handleReleasedPointerMove, true);
    window.removeEventListener('pointermove', this.handleReleasedPointerMove, true);
    window.removeEventListener('blur', this.releasePointerInteraction);
    window.removeEventListener('pagehide', this.releasePointerInteraction);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    await this.canvas.dispose();
  }

  private buildScene(): void {
    const group = getActivePageGroup(this.document, this.activePageId);
    const layout = getPageLayout(group);
    createPageDecorations(layout).forEach((object) => this.canvas.add(object));
    this.gridObjects = createGridDecorations(layout);
    this.gridObjects.forEach((object) => {
      object.visible = this.gridVisible;
      this.canvas.add(object);
    });
    const pageOrder = new Map(group.pages.map((page, index) => [page.id, index]));
    this.getActiveLayers()
      .filter((layer) => layer.kind !== 'group')
      .sort((left, right) => {
        const pageDifference =
          (pageOrder.get(left.pageId) ?? 0) - (pageOrder.get(right.pageId) ?? 0);
        return pageDifference || left.zIndex - right.zIndex;
      })
      .forEach((snapshot) => {
        const pageOffset = this.getPageOffsetMm(snapshot.pageId);
        this.canvas.add(
          createFabricObject(
            snapshot,
            pageOffset,
            snapshot.image ? this.getImageElement(snapshot.image.assetId) : undefined,
            snapshot.image?.svgMaskAssetId
              ? this.getImageElement(snapshot.image.svgMaskAssetId)
              : undefined,
          ),
        );
      });
    this.setContentInteraction(this.tool === 'select');
    this.canvas.requestRenderAll();
  }

  private rebuildScene(selectedIds: string[] = []): void {
    const transform = [...this.canvas.viewportTransform] as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    this.canvas.clear();
    this.canvas.backgroundColor = '#191d24';
    this.buildScene();
    this.canvas.setViewportTransform(transform);
    if (selectedIds.length > 0) this.selectLayers(selectedIds);
    this.canvas.requestRenderAll();
  }

  private bindCanvasEvents(): void {
    this.canvas.on('before:transform', ({ transform }) => {
      const target = transform.target as VakhaFabricObject;
      if (target.vakhaRole === 'content') this.activeTransformBefore = this.snapshotObject(target);
    });

    this.canvas.on('object:moving', ({ target }) => {
      if (!this.snappingEnabled || (target as VakhaFabricObject).vakhaRole !== 'content') return;
      const layout = getPageLayout(getActivePageGroup(this.document, this.activePageId));
      const step = millimetersToLogicalPixels(layout.gridStepMm);
      target.set({
        left: Math.round((target.left ?? 0) / step) * step,
        top: Math.round((target.top ?? 0) / step) * step,
      });
    });

    this.canvas.on('object:modified', ({ target, action }) => {
      const object = target as VakhaFabricObject;
      if (object.vakhaRole !== 'content') return;
      if (object instanceof Textbox && (object.isEditing || this.ignoreTextModified)) {
        this.activeTransformBefore = undefined;
        return;
      }
      const before = this.activeTransformBefore;
      const after = this.snapshotObject(object);
      this.activeTransformBefore = undefined;
      if (before && JSON.stringify(before) !== JSON.stringify(after)) {
        this.recordObjectChange(object, before, after, this.getActionLabel(action));
      }
    });

    this.canvas.on('text:editing:entered', ({ target }) => {
      const object = target as Textbox & VakhaFabricObject;
      if (!object.vakhaText) return;
      this.activeTransformBefore = undefined;
      this.textEditingBefore = this.snapshotObject(object);
      object.set({ text: object.vakhaText.content });
      object.initDimensions();
      object.setCoords();
      this.canvas.requestRenderAll();
    });

    this.canvas.on('text:changed', ({ target }) => {
      const object = target as Textbox & VakhaFabricObject;
      updateFabricTextContent(object, object.text);
    });

    this.canvas.on('text:editing:exited', ({ target }) => {
      const object = target as Textbox & VakhaFabricObject;
      if (!object.vakhaText) return;
      updateFabricTextContent(object, object.text);
      const before = this.textEditingBefore;
      const after = this.snapshotObject(object);
      this.textEditingBefore = undefined;
      this.ignoreTextModified = true;
      window.setTimeout(() => {
        this.ignoreTextModified = false;
      }, 0);
      applySnapshotToFabricObject(object, after, this.getPageOffsetMm(after.pageId));
      if (before && before.text?.content !== after.text?.content) {
        this.recordObjectChange(object, before, after, 'Редактирование текста');
      } else {
        this.canvas.requestRenderAll();
      }
    });

    const updateSelection = () => {
      const selection = this.canvas.getActiveObject();
      if (selection instanceof ActiveSelection) this.configureActiveSelection(selection);
      if (!this.suspendSelectionState) this.emitState();
    };
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
      if (this.isPointerReleased(e)) {
        this.releasePointerInteraction(e);
        return;
      }
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

    this.canvas.on('mouse:up:before', ({ e }) => {
      this.releasePointerInteraction(e);
    });

    this.canvas.on('mouse:up', () => {
      this.releaseViewportDrag();
    });

    this.canvas.on('mouse:dblclick', ({ target }) => this.handleImageFrameDoubleClick(target));
  }

  private handleImageFrameDoubleClick(object?: VakhaFabricObject): void {
    const layerId = typeof object?.vakhaId === 'string' ? object.vakhaId : undefined;
    if (!layerId || object?.vakhaRole !== 'content') return;
    const layer = this.getLayer(layerId);
    if (!layer?.image || !['frame', 'image'].includes(layer.kind)) return;
    this.selectLayers([layer.id]);
    this.onFrameReplaceRequest?.(layer.id);
  }

  private isPointerReleased(event: Event): boolean {
    const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent;
    return (
      (event instanceof MouseEvent || isPointerEvent) &&
      event.buttons === 0 &&
      event.type !== 'mouseup' &&
      event.type !== 'pointerup'
    );
  }

  private releaseViewportDrag(): void {
    if (!this.draggingViewport) return;
    this.draggingViewport = false;
    this.setContentInteraction(this.tool === 'select' && !this.spacePressed);
    this.canvas.defaultCursor = this.tool === 'pan' ? 'grab' : 'default';
  }

  private releasePointerInteraction = (event: Event): void => {
    this.releaseViewportDrag();
    const canvas = this.canvas as FabricTransformCanvas;
    if (!canvas._currentTransform) return;
    canvas.endCurrentTransform(event);
    this.canvas.requestRenderAll();
    this.emitState();
  };

  private releaseStaleTransformBeforePointerDown = (event: Event): void => {
    const canvas = this.canvas as FabricTransformCanvas;
    if (!canvas._currentTransform) return;
    this.releasePointerInteraction(event);
  };

  private handleReleasedPointerMove = (event: MouseEvent | PointerEvent): void => {
    if (event.buttons !== 0) return;
    this.releasePointerInteraction(event);
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.releasePointerInteraction(new Event('visibilitychange'));
    }
  };

  private setZoom(value: number): void {
    const zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    const center = new Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2);
    this.canvas.zoomToPoint(center, zoom);
    this.canvas.requestRenderAll();
    this.emitState();
  }

  private recordObjectChange(
    object: VakhaFabricObject,
    before: CanvasLayerSnapshot,
    after: CanvasLayerSnapshot,
    label: string,
  ): void {
    const apply = (snapshot: CanvasLayerSnapshot) => {
      applySnapshotToFabricObject(
        object,
        snapshot,
        this.getPageOffsetMm(snapshot.pageId),
        snapshot.image?.svgMaskAssetId
          ? this.getImageElement(snapshot.image.svgMaskAssetId)
          : undefined,
      );
      this.canvas.setActiveObject(object);
      this.canvas.requestRenderAll();
      this.notifyDocumentChanged();
    };
    this.history.record({ label, undo: () => apply(before), redo: () => apply(after) });
    this.canvas.requestRenderAll();
    this.notifyDocumentChanged();
  }

  private updateDocument(
    label: string,
    update: (document: CanvasDocument) => CanvasDocument,
    rebuild = true,
  ): void {
    const before = this.serializeDocument();
    const selectedIds = this.canvas
      .getActiveObjects()
      .flatMap((object) => (object as VakhaFabricObject).vakhaId ?? []);
    const after = normalizeDocumentOrder({
      ...update(before),
      updatedAt: new Date().toISOString(),
    });
    const apply = (document: CanvasDocument) => {
      this.document = document;
      if (rebuild) {
        const existingSelectedIds = selectedIds.filter((id) =>
          document.layers.some((layer) => layer.id === id),
        );
        this.rebuildScene(existingSelectedIds);
      }
      this.onDocumentChange(document);
      this.emitState();
    };
    apply(after);
    this.history.record({ label, undo: () => apply(before), redo: () => apply(after) });
  }

  private notifyDocumentChanged(): void {
    this.document = this.serializeDocument();
    this.onDocumentChange(this.document);
    this.emitState();
  }

  private serializeDocument(): CanvasDocument {
    const activePageIds = new Set(
      getActivePageGroup(this.document, this.activePageId).pages.map((page) => page.id),
    );
    const inactiveAndGroups = this.document.layers.filter(
      (layer) => !activePageIds.has(layer.pageId) || layer.kind === 'group',
    );
    const activeObject = this.canvas.getActiveObject();
    const activeSelectionIds =
      activeObject instanceof ActiveSelection
        ? activeObject.getObjects().flatMap((object) => (object as VakhaFabricObject).vakhaId ?? [])
        : [];
    if (activeSelectionIds.length > 0) {
      this.suspendSelectionState = true;
      this.canvas.discardActiveObject();
    }
    const renderedLayers = this.canvas
      .getObjects()
      .filter((object) => (object as VakhaFabricObject).vakhaRole === 'content')
      .map((object) => {
        const vakhaObject = object as VakhaFabricObject;
        return fabricObjectToSnapshot(
          vakhaObject,
          this.getPageOffsetMm(vakhaObject.vakhaPageId ?? ''),
        );
      });
    if (activeSelectionIds.length > 0) {
      const selectedObjects = this.canvas
        .getObjects()
        .filter((object) =>
          activeSelectionIds.includes((object as VakhaFabricObject).vakhaId ?? ''),
        );
      const selection = new ActiveSelection(selectedObjects, { canvas: this.canvas });
      this.configureActiveSelection(selection);
      this.canvas.setActiveObject(selection);
      this.suspendSelectionState = false;
    }
    return normalizeDocumentOrder({
      ...this.document,
      layers: [...inactiveAndGroups, ...renderedLayers],
      updatedAt: new Date().toISOString(),
    });
  }

  private snapshotObject(object: VakhaFabricObject): CanvasLayerSnapshot {
    return fabricObjectToSnapshot(object, this.getPageOffsetMm(object.vakhaPageId ?? ''));
  }

  private getSelectedContentObject(): VakhaFabricObject | undefined {
    const selected = this.canvas.getActiveObjects();
    if (selected.length !== 1) return undefined;
    const object = selected[0] as VakhaFabricObject;
    return object.vakhaRole === 'content' ? object : undefined;
  }

  private emitState(forcedSelectedIds?: string[]): void {
    const selectedIds =
      forcedSelectedIds ??
      this.canvas
        .getActiveObjects()
        .flatMap((object) => (object as VakhaFabricObject).vakhaId ?? []);
    const selected = selectedIds.length === 1 ? this.getLayer(selectedIds[0]!) : undefined;
    const textIssues = Object.fromEntries(
      this.getActiveLayers()
        .filter((layer) => layer.kind === 'text' && layer.text)
        .map((layer) => {
          const object = this.canvas
            .getObjects()
            .find((candidate) => (candidate as VakhaFabricObject).vakhaId === layer.id);
          return [
            layer.id,
            {
              overflow: object?.vakhaTextOverflow === true,
              missingFont: !this.isFontAvailable(layer.text!.fontFamily, layer.text!.fontAssetId),
            },
          ];
        }),
    );
    const imageIssues = Object.fromEntries(
      this.getActiveLayers()
        .filter((layer) => layer.image)
        .map((layer) => {
          const image = layer.image!;
          const cropWidthPx =
            image.fit === 'cover' ? image.naturalWidthPx / image.zoom : image.naturalWidthPx;
          const cropHeightPx =
            image.fit === 'cover' ? image.naturalHeightPx / image.zoom : image.naturalHeightPx;
          const effectiveDpi = Math.round(
            Math.min(cropWidthPx / (layer.widthMm / 25.4), cropHeightPx / (layer.heightMm / 25.4)),
          );
          return [
            layer.id,
            {
              effectiveDpi,
              lowQuality: effectiveDpi < 200,
              missing: !this.getImageElement(image.assetId),
              missingMask: Boolean(
                image.svgMaskAssetId && !this.getImageElement(image.svgMaskAssetId),
              ),
            },
          ];
        }),
    );
    this.onStateChange({
      zoom: this.canvas.getZoom(),
      viewportX: this.canvas.viewportTransform[4],
      viewportY: this.canvas.viewportTransform[5],
      selected,
      selectedIds,
      layers: this.getActiveLayers(),
      textIssues,
      imageIssues,
      ...this.history.getState(),
    });
  }

  private setContentInteraction(enabled: boolean): void {
    this.canvas.selection = enabled;
    this.canvas.getObjects().forEach((object) => {
      const vakhaObject = object as VakhaFabricObject;
      if (vakhaObject.vakhaRole === 'content') {
        const layer = this.getLayer(vakhaObject.vakhaId ?? '');
        object.selectable = enabled && !layer?.locked;
        object.evented = enabled && !layer?.locked;
      }
    });
  }

  private getLayer(layerId: string): CanvasLayerSnapshot | undefined {
    return this.document.layers.find((layer) => layer.id === layerId);
  }

  private getActiveLayers(): CanvasLayerSnapshot[] {
    const pageIds = new Set(
      getActivePageGroup(this.document, this.activePageId).pages.map((page) => page.id),
    );
    return this.document.layers
      .filter((layer) => pageIds.has(layer.pageId))
      .sort((left, right) => right.zIndex - left.zIndex);
  }

  private getDescendantIds(layerId: string): string[] {
    const children = this.document.layers.filter((layer) => layer.parentId === layerId);
    return children.flatMap((child) => [child.id, ...this.getDescendantIds(child.id)]);
  }

  private getRenderableDescendantIds(layerId: string): string[] {
    const layer = this.getLayer(layerId);
    if (!layer) return [];
    if (layer.kind !== 'group') return [layerId];
    return this.getDescendantIds(layerId).filter((id) => this.getLayer(id)?.kind !== 'group');
  }

  private getLayerDepth(layerId: string): number {
    let depth = 1;
    let current = this.getLayer(layerId);
    while (current?.parentId) {
      depth += 1;
      current = this.getLayer(current.parentId);
    }
    return depth;
  }

  private configureActiveSelection(selection: ActiveSelection): void {
    selection.set({
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    });
  }

  private getPageOffsetMm(pageId: string): number {
    const group = getActivePageGroup(this.document, this.activePageId);
    const index = group.pages.findIndex((page) => page.id === pageId);
    return index > 0 ? group.pages[0]!.widthMm : 0;
  }

  private newId(prefix: string): string {
    return `${this.document.projectId}:${prefix}-${crypto.randomUUID()}`;
  }

  private getActionLabel(action?: string): string {
    if (action?.includes('rotate')) return 'Поворот объекта';
    if (action?.includes('scale') || action?.includes('resize')) return 'Изменение размера';
    return 'Перемещение объекта';
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.matches('input, textarea, [contenteditable="true"]')
    )
      return;
    if (event.key === 'Enter' || event.key === 'Escape') {
      const canvas = this.canvas as FabricTransformCanvas;
      if (canvas._currentTransform) {
        event.preventDefault();
        this.releasePointerInteraction(event);
        return;
      }
    }
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedIds = this.canvas
        .getActiveObjects()
        .flatMap((object) => (object as VakhaFabricObject).vakhaId ?? []);
      if (selectedIds.length === 1) this.deleteLayer(selectedIds[0]!);
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
