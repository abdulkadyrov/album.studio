import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
} from 'react';

import {
  CanvasController,
  type CanvasControllerState,
  type CanvasTool,
  type ImageLayerUpdate,
  type TextLayerUpdate,
} from '../../canvas/engine/CanvasController';
import {
  createDefaultCanvasDocument,
  getPageGroups,
  type CanvasDocument,
  type CanvasLayerSnapshot,
  type CanvasPageGroup,
} from '../../canvas/model/canvas-document';
import {
  addPage,
  addSpread,
  deletePageGroup,
  duplicatePageGroup,
  movePageGroup,
} from '../../canvas/model/document-commands';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import { fontRepository, type FontAsset } from '../../data/repositories/font-repository';
import { imageRepository, type ImageAsset } from '../../data/repositories/image-repository';
import { fontRegistry } from '../../services/font-registry';
import { imageObjectUrlRegistry } from '../../services/image-object-url-registry';
import type { SaveStatus } from '../../stores/project-store';

export interface PageNavigationState {
  groups: CanvasPageGroup[];
  activeGroupId: string;
  activePageId: string;
  layerCountByPage: Record<string, number>;
  layersByPage: Record<string, CanvasLayerSnapshot[]>;
}

export interface FontWorkspaceState {
  fonts: FontAsset[];
  error?: string;
}

export interface ImageWorkspaceState {
  assets: ImageAsset[];
  error?: string;
}

export interface CanvasWorkspaceHandle {
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reset: () => void;
  selectLayers: (layerIds: string[]) => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  duplicateLayer: (layerId: string) => void;
  deleteLayer: (layerId: string) => void;
  moveLayer: (layerId: string, direction: -1 | 1) => void;
  reorderLayer: (layerId: string, targetLayerId: string) => void;
  groupLayers: (layerIds: string[]) => void;
  ungroupLayer: (layerId: string) => void;
  selectPageGroup: (groupId: string) => void;
  addPage: () => void;
  addSpread: () => void;
  duplicatePageGroup: (groupId: string) => void;
  deletePageGroup: (groupId: string) => void;
  movePageGroup: (groupId: string, direction: -1 | 1) => void;
  addTextLayer: () => void;
  updateTextLayer: (layerId: string, patch: TextLayerUpdate) => void;
  uploadImages: (
    files: File[],
    kind?: 'image' | 'frame' | 'decoration' | 'background',
  ) => Promise<void>;
  addShapeLayer: (kind?: 'rect' | 'circle') => void;
  replaceImage: (layerId: string, file: File) => Promise<void>;
  setSvgMask: (layerId: string, file: File) => Promise<void>;
  updateImageLayer: (layerId: string, patch: ImageLayerUpdate) => void;
  uploadFont: (file: File, family: string) => Promise<void>;
  deleteFont: (fontId: string) => Promise<void>;
  toggleFontFavorite: (fontId: string, favorite: boolean) => Promise<void>;
}

interface CanvasWorkspaceProps {
  projectId: string;
  tool: CanvasTool;
  gridVisible: boolean;
  snappingEnabled: boolean;
  onStateChange: (state: CanvasControllerState) => void;
  onPageStateChange: (state: PageNavigationState) => void;
  onFontStateChange: (state: FontWorkspaceState) => void;
  onImageStateChange: (state: ImageWorkspaceState) => void;
  onSaveStatusChange: (status: SaveStatus) => void;
}

function CanvasWorkspaceComponent(
  {
    projectId,
    tool,
    gridVisible,
    snappingEnabled,
    onStateChange,
    onPageStateChange,
    onFontStateChange,
    onImageStateChange,
    onSaveStatusChange,
  }: CanvasWorkspaceProps,
  ref: ForwardedRef<CanvasWorkspaceHandle>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CanvasController>();
  const documentRef = useRef<CanvasDocument>();
  const activePageIdRef = useRef<string>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initialOptionsRef = useRef({ tool, gridVisible, snappingEnabled });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const refreshImageState = useCallback(async () => {
    onImageStateChange({ assets: await imageRepository.list(projectId) });
  }, [onImageStateChange, projectId]);

  const importImages = useCallback(
    async (files: File[], kind: 'image' | 'frame' | 'decoration' | 'background' = 'image') => {
      try {
        for (const file of files) {
          const asset = await imageRepository.save(file, projectId);
          await imageObjectUrlRegistry.register(asset.id);
          controllerRef.current?.addImageLayer(asset, kind);
        }
        await refreshImageState();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось загрузить изображение';
        onImageStateChange({ assets: await imageRepository.list(projectId), error: message });
        throw error;
      }
    },
    [onImageStateChange, projectId, refreshImageState],
  );

  const emitPageState = useCallback(
    (document: CanvasDocument, activePageId: string) => {
      const groups = getPageGroups(document.pages);
      const activeGroup = groups.find((group) =>
        group.pages.some((page) => page.id === activePageId),
      )!;
      const layerCountByPage = document.layers.reduce<Record<string, number>>((counts, layer) => {
        if (layer.kind !== 'group') counts[layer.pageId] = (counts[layer.pageId] ?? 0) + 1;
        return counts;
      }, {});
      const layersByPage = document.layers.reduce<Record<string, CanvasLayerSnapshot[]>>(
        (byPage, layer) => {
          if (layer.kind !== 'group')
            byPage[layer.pageId] = [...(byPage[layer.pageId] ?? []), layer];
          return byPage;
        },
        {},
      );
      onPageStateChange({
        groups,
        activeGroupId: activeGroup.id,
        activePageId,
        layerCountByPage,
        layersByPage,
      });
    },
    [onPageStateChange],
  );

  const queueSave = useCallback(
    (document: CanvasDocument) => {
      documentRef.current = document;
      onSaveStatusChange('dirty');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSaveStatusChange('saving');
        void canvasSceneRepository
          .save(document)
          .then(() => onSaveStatusChange('saved'))
          .catch(() => onSaveStatusChange('error'));
      }, 280);
    },
    [onSaveStatusChange],
  );

  const applyDocument = useCallback(
    (document: CanvasDocument, activePageId: string) => {
      documentRef.current = document;
      activePageIdRef.current = activePageId;
      controllerRef.current?.loadDocument(document, activePageId);
      emitPageState(document, activePageId);
      queueSave(document);
    },
    [emitPageState, queueSave],
  );

  useImperativeHandle(
    ref,
    () => ({
      undo: () => controllerRef.current?.undo(),
      redo: () => controllerRef.current?.redo(),
      zoomIn: () => controllerRef.current?.zoomIn(),
      zoomOut: () => controllerRef.current?.zoomOut(),
      fit: () => controllerRef.current?.fitToViewport(),
      reset: () => controllerRef.current?.resetToDefault(),
      selectLayers: (ids) => controllerRef.current?.selectLayers(ids),
      renameLayer: (id, name) => controllerRef.current?.renameLayer(id, name),
      toggleLayerVisibility: (id) => controllerRef.current?.toggleLayerVisibility(id),
      toggleLayerLock: (id) => controllerRef.current?.toggleLayerLock(id),
      duplicateLayer: (id) => controllerRef.current?.duplicateLayer(id),
      deleteLayer: (id) => controllerRef.current?.deleteLayer(id),
      moveLayer: (id, direction) => controllerRef.current?.moveLayer(id, direction),
      reorderLayer: (id, targetId) => controllerRef.current?.reorderLayer(id, targetId),
      groupLayers: (ids) => controllerRef.current?.groupLayers(ids),
      ungroupLayer: (id) => controllerRef.current?.ungroupLayer(id),
      selectPageGroup: (groupId) => {
        const document = documentRef.current;
        if (!document) return;
        const group = getPageGroups(document.pages).find((candidate) => candidate.id === groupId);
        if (group) applyDocument(document, group.pages[0]!.id);
      },
      addPage: () => {
        const document = documentRef.current;
        if (!document) return;
        const result = addPage(document);
        applyDocument(result.document, result.activePageId);
      },
      addSpread: () => {
        const document = documentRef.current;
        if (!document) return;
        const result = addSpread(document);
        applyDocument(result.document, result.activePageId);
      },
      duplicatePageGroup: (groupId) => {
        const document = documentRef.current;
        if (!document) return;
        const result = duplicatePageGroup(document, groupId);
        applyDocument(result.document, result.activePageId);
      },
      deletePageGroup: (groupId) => {
        const document = documentRef.current;
        if (!document) return;
        const result = deletePageGroup(document, groupId);
        applyDocument(result.document, result.activePageId);
      },
      movePageGroup: (groupId, direction) => {
        const document = documentRef.current;
        const activePageId = activePageIdRef.current;
        if (!document || !activePageId) return;
        applyDocument(movePageGroup(document, groupId, direction), activePageId);
      },
      addTextLayer: () => controllerRef.current?.addTextLayer(),
      updateTextLayer: (layerId, patch) => {
        controllerRef.current?.updateTextLayer(layerId, patch);
        const fontAssetId = patch.text?.fontAssetId;
        if (fontAssetId) {
          void fontRepository.markUsed(fontAssetId).then(async () => {
            await fontRegistry.initialize();
            onFontStateChange({ fonts: fontRegistry.getAssets() });
          });
        }
      },
      uploadImages: importImages,
      addShapeLayer: (kind = 'rect') => controllerRef.current?.addShapeLayer(kind),
      replaceImage: async (layerId, file) => {
        const asset = await imageRepository.save(file, projectId);
        await imageObjectUrlRegistry.register(asset.id);
        controllerRef.current?.updateImageLayer(layerId, {
          image: {
            assetId: asset.id,
            thumbnailAssetId: asset.thumbnailId,
            filename: asset.filename,
            mimeType: asset.mimeType,
            naturalWidthPx: asset.widthPx,
            naturalHeightPx: asset.heightPx,
            cropX: 0.5,
            cropY: 0.5,
            zoom: 1,
          },
        });
        await refreshImageState();
      },
      setSvgMask: async (layerId, file) => {
        if (file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg'))
          throw new Error('Для маски требуется безопасный SVG');
        const asset = await imageRepository.save(file, projectId);
        await imageObjectUrlRegistry.register(asset.id);
        controllerRef.current?.updateImageLayer(layerId, {
          image: { frameShape: 'svg', svgMaskAssetId: asset.id },
        });
        await refreshImageState();
      },
      updateImageLayer: (layerId, patch) => controllerRef.current?.updateImageLayer(layerId, patch),
      uploadFont: async (file, family) => {
        try {
          const asset = await fontRepository.save(file, family);
          await fontRegistry.register(asset);
          onFontStateChange({ fonts: fontRegistry.getAssets() });
          controllerRef.current?.refreshFonts();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось загрузить шрифт';
          onFontStateChange({ fonts: fontRegistry.getAssets(), error: message });
          throw error;
        }
      },
      deleteFont: async (fontId) => {
        await fontRepository.delete(fontId);
        fontRegistry.unregister(fontId);
        onFontStateChange({ fonts: fontRegistry.getAssets() });
        controllerRef.current?.refreshFonts();
      },
      toggleFontFavorite: async (fontId, favorite) => {
        await fontRepository.setFavorite(fontId, favorite);
        await fontRegistry.initialize();
        onFontStateChange({ fonts: fontRegistry.getAssets() });
      },
    }),
    [applyDocument, importImages, onFontStateChange, projectId, refreshImageState],
  );

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | undefined;

    const initialize = async () => {
      try {
        const fonts = await fontRegistry.initialize();
        onFontStateChange({ fonts });
        const document =
          (await canvasSceneRepository.load(projectId)) ?? createDefaultCanvasDocument(projectId);
        const imageAssets = await imageObjectUrlRegistry.initialize(
          projectId,
          document.layers.flatMap((layer) =>
            layer.image
              ? [
                  layer.image.assetId,
                  ...(layer.image.svgMaskAssetId ? [layer.image.svgMaskAssetId] : []),
                ]
              : [],
          ),
        );
        onImageStateChange({ assets: imageAssets });
        if (!active || !canvasRef.current || !hostRef.current) return;
        const activePageId = document.pages[0]!.id;
        documentRef.current = document;
        activePageIdRef.current = activePageId;
        emitPageState(document, activePageId);

        const controller = new CanvasController(canvasRef.current, {
          document,
          activePageId,
          onDocumentChange: (nextDocument) => {
            documentRef.current = nextDocument;
            imageObjectUrlRegistry.retain(
              nextDocument.layers.flatMap((layer) =>
                layer.image
                  ? [
                      layer.image.assetId,
                      ...(layer.image.svgMaskAssetId ? [layer.image.svgMaskAssetId] : []),
                    ]
                  : [],
              ),
            );
            emitPageState(nextDocument, activePageIdRef.current ?? nextDocument.pages[0]!.id);
            queueSave(nextDocument);
          },
          onStateChange: (state) => {
            if (hostRef.current) {
              hostRef.current.dataset.zoom = String(state.zoom);
              hostRef.current.dataset.viewportX = String(state.viewportX);
              hostRef.current.dataset.viewportY = String(state.viewportY);
            }
            onStateChange(state);
          },
          isFontAvailable: (family, assetId) => fontRegistry.isAvailable(family, assetId),
          getImageElement: (assetId) => imageObjectUrlRegistry.getElement(assetId),
        });
        controllerRef.current = controller;
        controller.setTool(initialOptionsRef.current.tool);
        controller.setGridVisible(initialOptionsRef.current.gridVisible);
        controller.setSnapping(initialOptionsRef.current.snappingEnabled);

        resizeObserver = new ResizeObserver(([entry]) => {
          if (entry) controller.resize(entry.contentRect.width, entry.contentRect.height);
        });
        resizeObserver.observe(hostRef.current);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    };

    void initialize();

    return () => {
      active = false;
      resizeObserver?.disconnect();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const pendingDocument = documentRef.current;
      if (pendingDocument) void canvasSceneRepository.save(pendingDocument);
      const controller = controllerRef.current;
      controllerRef.current = undefined;
      if (controller) void controller.dispose();
      imageObjectUrlRegistry.clear();
    };
  }, [emitPageState, onFontStateChange, onImageStateChange, onStateChange, projectId, queueSave]);

  useEffect(() => controllerRef.current?.setTool(tool), [tool]);
  useEffect(() => controllerRef.current?.setGridVisible(gridVisible), [gridVisible]);
  useEffect(() => controllerRef.current?.setSnapping(snappingEnabled), [snappingEnabled]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
        file.type.startsWith('image/'),
      );
      if (files.length > 0) {
        event.preventDefault();
        void importImages(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [importImages]);

  return (
    <section
      ref={hostRef}
      className="canvas-host"
      aria-label="Интерактивный холст разворота"
      data-testid="canvas-workspace"
      data-status={status}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        const files = [...event.dataTransfer.files].filter((file) =>
          file.type.startsWith('image/'),
        );
        if (files.length > 0) {
          event.preventDefault();
          void importImages(files);
        }
      }}
    >
      <canvas ref={canvasRef} aria-label="Холст Fabric.js" />
      {status === 'loading' ? (
        <div className="canvas-message">Загрузка локальной сцены…</div>
      ) : null}
      {status === 'error' ? (
        <div className="canvas-message canvas-message--error" role="alert">
          Не удалось открыть локальную сцену
        </div>
      ) : null}
    </section>
  );
}

export const CanvasWorkspace = forwardRef(CanvasWorkspaceComponent);
