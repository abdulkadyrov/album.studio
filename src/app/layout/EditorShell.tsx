import {
  ArrowLeft,
  Download,
  Frame,
  Grid3X3,
  Hand,
  ImagePlus,
  Layers3,
  Link2,
  Magnet,
  Maximize2,
  Minus,
  MousePointer2,
  Palette,
  Plus,
  QrCode,
  Redo2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Type,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { routes } from '../routes';
import { useUiStore } from '../../stores/ui-store';
import { CanvasWorkspace, type CanvasWorkspaceHandle } from '../../features/editor/CanvasWorkspace';
import type { CanvasControllerState, CanvasTool } from '../../canvas/engine/CanvasController';
import type { SaveStatus } from '../../stores/project-store';

interface EditorToolDefinition {
  id?: CanvasTool | 'zoom';
  label: string;
  icon: LucideIcon;
  enabled?: boolean;
}

const tools: readonly EditorToolDefinition[] = [
  { id: 'select', label: 'Выделение', icon: MousePointer2, enabled: true },
  { label: 'Текст', icon: Type },
  { label: 'Фото', icon: ImagePlus },
  { label: 'Фоторамка', icon: Frame },
  { label: 'Фигура', icon: Shapes },
  { label: 'Декор', icon: Sparkles },
  { label: 'Фон', icon: Palette },
  { label: 'QR-код', icon: QrCode },
  { label: 'Таблица', icon: Table2 },
  { id: 'pan', label: 'Рука', icon: Hand, enabled: true },
  { id: 'zoom', label: 'Масштаб', icon: ZoomIn, enabled: true },
] as const;

const inspectorTabs = [
  { id: 'properties', label: 'Свойства', icon: SlidersHorizontal },
  { id: 'layers', label: 'Слои', icon: Layers3 },
  { id: 'effects', label: 'Эффекты', icon: Sparkles },
  { id: 'bindings', label: 'Привязки', icon: Link2 },
] as const;

type InspectorTab = (typeof inspectorTabs)[number]['id'];

export function EditorShell() {
  const { projectId = 'preview' } = useParams();
  const navigate = useNavigate();
  const accent = useUiStore((state) => state.accent);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('layers');
  const canvasRef = useRef<CanvasWorkspaceHandle>(null);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [gridVisible, setGridVisible] = useState(true);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [canvasState, setCanvasState] = useState<CanvasControllerState>({
    zoom: 1,
    viewportX: 0,
    viewportY: 0,
    canUndo: false,
    canRedo: false,
  });

  const handleCanvasState = useCallback((state: CanvasControllerState) => {
    setCanvasState(state);
  }, []);

  const handleSaveStatus = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  const selectTool = (id?: string) => {
    if (id === 'select' || id === 'pan') setTool(id);
    if (id === 'zoom') canvasRef.current?.fit();
  };

  const resetCanvas = () => {
    if (window.confirm('Сбросить расположение демонстрационных объектов?')) {
      canvasRef.current?.reset();
    }
  };

  const saveStatusLabel: Record<SaveStatus, string> = {
    saved: 'Сохранено локально',
    dirty: 'Есть изменения',
    saving: 'Сохранение…',
    error: 'Ошибка сохранения',
  };

  return (
    <div className="editor-shell" data-accent={accent} data-testid="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__project">
          <Link className="icon-button" to={routes.projects} aria-label="Назад к проектам">
            <ArrowLeft size={17} />
          </Link>
          <span className="editor-logo">V</span>
          <div>
            <strong>Новый альбом</strong>
            <small>Проект · {projectId}</small>
          </div>
        </div>
        <div className="editor-topbar__status">
          <span className={`save-indicator save-indicator--${saveStatus}`}>
            <i />
            {saveStatusLabel[saveStatus]}
          </span>
          <IconButton
            label={canvasState.undoLabel ? `Отменить: ${canvasState.undoLabel}` : 'Отменить'}
            icon={<Undo2 size={16} />}
            disabled={!canvasState.canUndo}
            onClick={() => canvasRef.current?.undo()}
          />
          <IconButton
            label={canvasState.redoLabel ? `Повторить: ${canvasState.redoLabel}` : 'Повторить'}
            icon={<Redo2 size={16} />}
            disabled={!canvasState.canRedo}
            onClick={() => canvasRef.current?.redo()}
          />
          <div className="zoom-toolbar" aria-label="Масштаб холста">
            <IconButton
              label="Уменьшить"
              icon={<Minus size={14} />}
              onClick={() => canvasRef.current?.zoomOut()}
            />
            <button className="zoom-control" type="button" onClick={() => canvasRef.current?.fit()}>
              {Math.round(canvasState.zoom * 100)}%
            </button>
            <IconButton
              label="Увеличить"
              icon={<Plus size={14} />}
              onClick={() => canvasRef.current?.zoomIn()}
            />
            <IconButton
              label="Уместить разворот"
              icon={<Maximize2 size={14} />}
              onClick={() => canvasRef.current?.fit()}
            />
          </div>
          <IconButton
            label="Показать сетку"
            icon={<Grid3X3 size={15} />}
            active={gridVisible}
            onClick={() => setGridVisible((value) => !value)}
          />
          <IconButton
            label="Привязка к сетке"
            icon={<Magnet size={15} />}
            active={snappingEnabled}
            onClick={() => setSnappingEnabled((value) => !value)}
          />
        </div>
        <Button
          variant="primary"
          icon={<Download size={15} />}
          onClick={() => navigate(routes.export(projectId))}
        >
          Экспорт
        </Button>
      </header>

      <aside className="editor-tools" aria-label="Инструменты редактора">
        {tools.map(({ label, icon: Icon, id, enabled = false }) => {
          const isActive = id === tool;
          return (
            <button
              key={label}
              className={`tool-button ${isActive ? 'is-active' : ''}`}
              type="button"
              aria-label={label}
              title={enabled ? label : `${label} — будет добавлено позже`}
              disabled={!enabled}
              onClick={() => selectTool(id)}
            >
              <Icon size={18} strokeWidth={1.65} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </aside>

      <main className="editor-workspace">
        <div className="ruler ruler--horizontal" aria-hidden="true">
          <span>0</span>
          <span>50</span>
          <span>100</span>
          <span>150</span>
          <span>200</span>
          <span>250</span>
        </div>
        <div className="ruler ruler--vertical" aria-hidden="true">
          <span>0</span>
          <span>50</span>
          <span>100</span>
          <span>150</span>
        </div>
        <CanvasWorkspace
          ref={canvasRef}
          projectId={projectId}
          tool={tool}
          gridVisible={gridVisible}
          snappingEnabled={snappingEnabled}
          onStateChange={handleCanvasState}
          onSaveStatusChange={handleSaveStatus}
        />
      </main>

      <aside className="editor-inspector">
        <div className="inspector-tabs" role="tablist" aria-label="Панель редактора">
          {inspectorTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={inspectorTab === id}
              className={inspectorTab === id ? 'is-active' : ''}
              onClick={() => setInspectorTab(id)}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="inspector-content">
          <span className="status-badge">Этап 2</span>
          <h2>{inspectorTabs.find((tab) => tab.id === inspectorTab)?.label}</h2>
          {inspectorTab === 'properties' ? (
            canvasState.selected ? (
              <div className="object-properties" data-testid="selection-properties">
                <strong>{canvasState.selected.name}</strong>
                <dl>
                  <div>
                    <dt>X</dt>
                    <dd>{canvasState.selected.xMm} мм</dd>
                  </div>
                  <div>
                    <dt>Y</dt>
                    <dd>{canvasState.selected.yMm} мм</dd>
                  </div>
                  <div>
                    <dt>Ширина</dt>
                    <dd>{canvasState.selected.widthMm} мм</dd>
                  </div>
                  <div>
                    <dt>Высота</dt>
                    <dd>{canvasState.selected.heightMm} мм</dd>
                  </div>
                  <div>
                    <dt>Угол</dt>
                    <dd>{canvasState.selected.rotationDeg}°</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p>Выберите объект на холсте, чтобы увидеть его координаты и размеры.</p>
            )
          ) : inspectorTab === 'layers' ? (
            <div className="canvas-layer-summary">
              <p>Объекты остаются независимыми и сериализуются в собственную модель проекта.</p>
              <div className={canvasState.selected ? 'is-selected' : ''}>
                <Shapes size={14} />
                <span>{canvasState.selected?.name ?? 'Объект не выбран'}</span>
              </div>
            </div>
          ) : (
            <p>Раздел будет подключён на соответствующем этапе. Сейчас он не имитирует работу.</p>
          )}
          <div className="inspector-stage-actions">
            <span>Сетка: {gridVisible ? 'включена' : 'скрыта'}</span>
            <span>Привязка: {snappingEnabled ? 'включена' : 'выключена'}</span>
            <Button variant="ghost" onClick={resetCanvas}>
              Сбросить демо-сцену
            </Button>
          </div>
        </div>
      </aside>

      <footer className="page-strip" aria-label="Страницы альбома">
        <div className="page-thumbnail is-active">
          <div>
            <span>V</span>
          </div>
          <small>Обложка</small>
        </div>
        <button type="button" className="add-page" disabled title="Будет добавлено позже">
          <span>+</span>
          <small>Страница</small>
        </button>
      </footer>
    </div>
  );
}
