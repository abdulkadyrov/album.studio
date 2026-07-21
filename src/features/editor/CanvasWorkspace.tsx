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
import type { SaveStatus } from '../../stores/project-store';

export interface PageNavigationState {
  groups: CanvasPageGroup[];
  activeGroupId: string;
  activePageId: string;
  layerCountByPage: Record<string, number>;
  layersByPage: Record<string, CanvasLayerSnapshot[]>;
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
}

interface CanvasWorkspaceProps {
  projectId: string;
  tool: CanvasTool;
  gridVisible: boolean;
  snappingEnabled: boolean;
  onStateChange: (state: CanvasControllerState) => void;
  onPageStateChange: (state: PageNavigationState) => void;
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
    }),
    [applyDocument],
  );

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | undefined;

    const initialize = async () => {
      try {
        const document =
          (await canvasSceneRepository.load(projectId)) ?? createDefaultCanvasDocument(projectId);
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
            emitPageState(nextDocument, activePageIdRef.current ?? nextDocument.pages[0]!.id);
            queueSave(nextDocument);
          },
          onStateChange: (state) => {
            if (hostRef.current) {
              hostRef.current.dataset.viewportX = String(state.viewportX);
              hostRef.current.dataset.viewportY = String(state.viewportY);
            }
            onStateChange(state);
          },
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
    };
  }, [emitPageState, onStateChange, projectId, queueSave]);

  useEffect(() => controllerRef.current?.setTool(tool), [tool]);
  useEffect(() => controllerRef.current?.setGridVisible(gridVisible), [gridVisible]);
  useEffect(() => controllerRef.current?.setSnapping(snappingEnabled), [snappingEnabled]);

  return (
    <section
      ref={hostRef}
      className="canvas-host"
      aria-label="Интерактивный холст разворота"
      data-testid="canvas-workspace"
      data-status={status}
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
