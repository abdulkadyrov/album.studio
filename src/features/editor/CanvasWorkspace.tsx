import {
  forwardRef,
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
import { createDefaultCanvasDocument } from '../../canvas/model/canvas-document';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import type { SaveStatus } from '../../stores/project-store';

export interface CanvasWorkspaceHandle {
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reset: () => void;
}

interface CanvasWorkspaceProps {
  projectId: string;
  tool: CanvasTool;
  gridVisible: boolean;
  snappingEnabled: boolean;
  onStateChange: (state: CanvasControllerState) => void;
  onSaveStatusChange: (status: SaveStatus) => void;
}

function CanvasWorkspaceComponent(
  {
    projectId,
    tool,
    gridVisible,
    snappingEnabled,
    onStateChange,
    onSaveStatusChange,
  }: CanvasWorkspaceProps,
  ref: ForwardedRef<CanvasWorkspaceHandle>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CanvasController>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const latestDocumentRef = useRef<ReturnType<CanvasController['getDocument']>>();
  const initialOptionsRef = useRef({ tool, gridVisible, snappingEnabled });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useImperativeHandle(
    ref,
    () => ({
      undo: () => controllerRef.current?.undo(),
      redo: () => controllerRef.current?.redo(),
      zoomIn: () => controllerRef.current?.zoomIn(),
      zoomOut: () => controllerRef.current?.zoomOut(),
      fit: () => controllerRef.current?.fitToViewport(),
      reset: () => controllerRef.current?.resetToDefault(),
    }),
    [],
  );

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | undefined;

    const initialize = async () => {
      try {
        const document =
          (await canvasSceneRepository.load(projectId)) ?? createDefaultCanvasDocument(projectId);
        if (!active || !canvasRef.current || !hostRef.current) return;

        const controller = new CanvasController(canvasRef.current, {
          document,
          onDocumentChange: (nextDocument) => {
            latestDocumentRef.current = nextDocument;
            onSaveStatusChange('dirty');
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
              onSaveStatusChange('saving');
              void canvasSceneRepository
                .save(nextDocument)
                .then(() => onSaveStatusChange('saved'))
                .catch(() => onSaveStatusChange('error'));
            }, 280);
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
          if (!entry) return;
          controller.resize(entry.contentRect.width, entry.contentRect.height);
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
      const pendingDocument = latestDocumentRef.current;
      if (pendingDocument) void canvasSceneRepository.save(pendingDocument);
      const controller = controllerRef.current;
      controllerRef.current = undefined;
      if (controller) void controller.dispose();
    };
  }, [projectId, onSaveStatusChange, onStateChange]);

  useEffect(() => {
    controllerRef.current?.setTool(tool);
  }, [tool]);

  useEffect(() => {
    controllerRef.current?.setGridVisible(gridVisible);
  }, [gridVisible]);

  useEffect(() => {
    controllerRef.current?.setSnapping(snappingEnabled);
  }, [snappingEnabled]);

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
