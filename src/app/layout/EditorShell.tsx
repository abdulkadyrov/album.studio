import {
  ArrowLeft,
  Check,
  Download,
  Frame,
  Grid3X3,
  Hand,
  ImagePlus,
  Layers3,
  Link2,
  Library,
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
  UserRound,
  ZoomIn,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { routes } from '../routes';
import { useUiStore } from '../../stores/ui-store';
import {
  CanvasWorkspace,
  type CanvasWorkspaceHandle,
  type FontWorkspaceState,
  type ImageWorkspaceState,
  type PageNavigationState,
} from '../../features/editor/CanvasWorkspace';
import { LayerPanel } from '../../features/editor/LayerPanel';
import { PageStrip } from '../../features/editor/PageStrip';
import { TextPropertiesPanel } from '../../features/editor/TextPropertiesPanel';
import { ImagePropertiesPanel } from '../../features/editor/ImagePropertiesPanel';
import type { CanvasControllerState, CanvasTool } from '../../canvas/engine/CanvasController';
import type { SaveStatus } from '../../stores/project-store';
import {
  participantRepository,
  type ParticipantWithPhotos,
} from '../../data/repositories/participant-repository';

interface EditorToolDefinition {
  id?: CanvasTool | 'zoom' | 'text' | 'photo' | 'frame' | 'shape' | 'decor' | 'background';
  label: string;
  icon: LucideIcon;
  enabled?: boolean;
}

type EditorToolId = NonNullable<EditorToolDefinition['id']>;

const tools: readonly EditorToolDefinition[] = [
  { id: 'select', label: 'Выделение', icon: MousePointer2, enabled: true },
  { id: 'text', label: 'Текст', icon: Type, enabled: true },
  { id: 'photo', label: 'Фото', icon: ImagePlus, enabled: true },
  { id: 'frame', label: 'Фоторамка', icon: Frame, enabled: true },
  { id: 'shape', label: 'Фигура', icon: Shapes, enabled: true },
  { id: 'decor', label: 'Декор', icon: Sparkles, enabled: true },
  { id: 'background', label: 'Фон', icon: Palette, enabled: true },
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const frameReplaceInputRef = useRef<HTMLInputElement>(null);
  const pendingImageKindRef = useRef<'image' | 'frame' | 'decoration' | 'background'>('image');
  const pendingFrameLayerIdRef = useRef<string>();
  const [tool, setTool] = useState<CanvasTool>('select');
  const [activeToolId, setActiveToolId] = useState<EditorToolId>('select');
  const [gridVisible, setGridVisible] = useState(true);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [canvasState, setCanvasState] = useState<CanvasControllerState>({
    zoom: 1,
    viewportX: 0,
    viewportY: 0,
    canUndo: false,
    canRedo: false,
    selectedIds: [],
    layers: [],
    textIssues: {},
    imageIssues: {},
  });
  const [pageState, setPageState] = useState<PageNavigationState>({
    groups: [],
    activeGroupId: '',
    activePageId: '',
    layerCountByPage: {},
    layersByPage: {},
  });
  const [fontState, setFontState] = useState<FontWorkspaceState>({ fonts: [] });
  const [imageState, setImageState] = useState<ImageWorkspaceState>({ assets: [] });
  const [participants, setParticipants] = useState<ParticipantWithPhotos[]>([]);
  const [editMode, setEditMode] = useState<'template' | 'participant'>('template');
  const [selectedParticipantId, setSelectedParticipantId] = useState('');

  const handleCanvasState = useCallback((state: CanvasControllerState) => {
    setCanvasState(state);
  }, []);

  const handleSaveStatus = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  const handlePageState = useCallback((state: PageNavigationState) => {
    setPageState(state);
  }, []);

  const handleFontState = useCallback((state: FontWorkspaceState) => {
    setFontState(state);
  }, []);

  const handleImageState = useCallback((state: ImageWorkspaceState) => {
    setImageState(state);
  }, []);

  const requestFrameReplace = useCallback((layerId: string) => {
    pendingFrameLayerIdRef.current = layerId;
    setTool('select');
    setActiveToolId('select');
    setInspectorTab('properties');
    frameReplaceInputRef.current?.click();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void participantRepository.list(projectId).then((nextParticipants) => {
      if (!cancelled) {
        setParticipants(nextParticipants);
        if (nextParticipants.length === 0) setEditMode('template');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const handlePageNavigation = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (canvasState.selectedIds.length > 0 || !['ArrowLeft', 'ArrowRight'].includes(event.key))
        return;
      const index = pageState.groups.findIndex((group) => group.id === pageState.activeGroupId);
      const nextIndex = event.key === 'ArrowRight' ? index + 1 : index - 1;
      const nextGroup = pageState.groups[nextIndex];
      if (!nextGroup) return;
      event.preventDefault();
      canvasRef.current?.selectPageGroup(nextGroup.id);
    };
    window.addEventListener('keydown', handlePageNavigation);
    return () => window.removeEventListener('keydown', handlePageNavigation);
  }, [canvasState.selectedIds.length, pageState.activeGroupId, pageState.groups]);

  const selectTool = (id?: string) => {
    if (!id) return;
    setActiveToolId(id as EditorToolId);
    if (id === 'select' || id === 'pan') setTool(id);
    if (id === 'zoom') {
      setTool('select');
      canvasRef.current?.fit();
    }
    if (id === 'text') {
      setTool('select');
      setInspectorTab('properties');
      canvasRef.current?.addTextLayer();
    }
    if (id === 'shape') {
      setTool('select');
      setInspectorTab('properties');
      canvasRef.current?.addShapeLayer('rect');
    }
    const imageKinds = {
      photo: 'image',
      frame: 'frame',
      decor: 'decoration',
      background: 'background',
    } as const;
    if (id && id in imageKinds) {
      pendingImageKindRef.current = imageKinds[id as keyof typeof imageKinds];
      imageInputRef.current?.click();
    }
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

  const effectiveParticipantId = participants.some((person) => person.id === selectedParticipantId)
    ? selectedParticipantId
    : (participants[0]?.id ?? '');
  const selectedParticipant = participants.find((person) => person.id === effectiveParticipantId);
  const participantLabel = (person: ParticipantWithPhotos) =>
    person.displayName ||
    [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');

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
          <div className="editor-mode-switch" aria-label="Режим редактирования">
            <UserRound size={14} aria-hidden="true" />
            <select
              value={editMode === 'participant' ? effectiveParticipantId : 'template'}
              onChange={(event) => {
                if (event.target.value === 'template') {
                  setEditMode('template');
                  return;
                }
                setSelectedParticipantId(event.target.value);
                setEditMode('participant');
                setInspectorTab('bindings');
              }}
              title={
                editMode === 'template'
                  ? 'Редактируется общий шаблон. Изменения увидят все участники.'
                  : `Редактируется экземпляр: ${selectedParticipant ? participantLabel(selectedParticipant) : ''}`
              }
            >
              <option value="template">Шаблон</option>
              {participants.map((person) => (
                <option key={person.id} value={person.id}>
                  {participantLabel(person)}
                </option>
              ))}
            </select>
          </div>
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
          {canvasState.selectedIds.length > 0 ? (
            <Button
              variant="primary"
              icon={<Check size={15} />}
              onClick={() => canvasRef.current?.confirmSelection()}
            >
              Готово
            </Button>
          ) : null}
        </div>
        <div className="editor-topbar__actions">
          <Button
            variant="secondary"
            icon={<Library size={15} />}
            onClick={() => {
              const name = window.prompt('Название шаблона', 'Мой шаблон')?.trim();
              if (!name) return;
              const scope = window.confirm(
                'Сохранить только текущую страницу? Нажмите «Отмена», чтобы сохранить весь проект.',
              )
                ? 'page'
                : 'project';
              void canvasRef.current
                ?.saveAsTemplate({
                  name,
                  description: 'Пользовательский шаблон из редактора',
                  category: 'general',
                  style: 'modern',
                  color: 'multicolor',
                  scope,
                })
                .then(() => window.alert('Шаблон сохранён локально в каталоге'));
            }}
          >
            В шаблоны
          </Button>
          <Button
            variant="primary"
            icon={<Download size={15} />}
            onClick={() => navigate(routes.export(projectId))}
          >
            Экспорт
          </Button>
        </div>
      </header>

      <aside className="editor-tools" aria-label="Инструменты редактора">
        <input
          ref={imageInputRef}
          className="sr-only"
          aria-label="Загрузить изображения"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          multiple
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length > 0) {
              setTool('select');
              setActiveToolId('select');
              setInspectorTab('properties');
              void canvasRef.current?.uploadImages(files, pendingImageKindRef.current);
            }
            event.target.value = '';
          }}
        />
        <input
          ref={frameReplaceInputRef}
          className="sr-only"
          aria-label="Выбрать фото для рамки"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const layerId = pendingFrameLayerIdRef.current;
            pendingFrameLayerIdRef.current = undefined;
            if (file && layerId) {
              void canvasRef.current?.replaceImage(layerId, file);
            }
            event.target.value = '';
          }}
        />
        {tools.map(({ label, icon: Icon, id, enabled = false }) => {
          const isActive = id === activeToolId;
          return (
            <button
              key={label}
              className={`tool-button ${isActive ? 'is-active' : ''}`}
              type="button"
              aria-label={label}
              aria-pressed={enabled ? isActive : undefined}
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
          key={`${projectId}:${editMode}:${editMode === 'participant' ? effectiveParticipantId : 'template'}`}
          ref={canvasRef}
          projectId={projectId}
          editMode={editMode}
          participantId={editMode === 'participant' ? effectiveParticipantId : undefined}
          tool={tool}
          gridVisible={gridVisible}
          snappingEnabled={snappingEnabled}
          onStateChange={handleCanvasState}
          onPageStateChange={handlePageState}
          onFontStateChange={handleFontState}
          onImageStateChange={handleImageState}
          onSaveStatusChange={handleSaveStatus}
          onFrameReplaceRequest={requestFrameReplace}
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
          <span className="status-badge">Этап 8</span>
          <h2>{inspectorTabs.find((tab) => tab.id === inspectorTab)?.label}</h2>
          {inspectorTab === 'properties' ? (
            canvasState.selected ? (
              canvasState.selected.image ? (
                <ImagePropertiesPanel
                  key={`${canvasState.selected.id}:${canvasState.selected.image.assetId}`}
                  layer={canvasState.selected}
                  issue={canvasState.imageIssues[canvasState.selected.id]}
                  error={imageState.error}
                  onUpdate={(patch) =>
                    canvasRef.current?.updateImageLayer(canvasState.selected!.id, patch)
                  }
                  onReplace={async (file) => {
                    await canvasRef.current?.replaceImage(canvasState.selected!.id, file);
                  }}
                  onUploadMask={async (file) => {
                    await canvasRef.current?.setSvgMask(canvasState.selected!.id, file);
                  }}
                />
              ) : canvasState.selected.kind === 'text' ? (
                <TextPropertiesPanel
                  key={`${canvasState.selected.id}:${canvasState.selected.text?.content ?? ''}`}
                  layer={canvasState.selected}
                  fonts={fontState.fonts}
                  fontError={fontState.error}
                  issue={canvasState.textIssues[canvasState.selected.id]}
                  onUpdate={(patch) =>
                    canvasRef.current?.updateTextLayer(canvasState.selected!.id, patch)
                  }
                  onUploadFont={async (file, family) => {
                    await canvasRef.current?.uploadFont(file, family);
                  }}
                  onDeleteFont={async (fontId) => {
                    await canvasRef.current?.deleteFont(fontId);
                  }}
                  onToggleFavorite={async (fontId, favorite) => {
                    await canvasRef.current?.toggleFontFavorite(fontId, favorite);
                  }}
                />
              ) : (
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
              )
            ) : (
              <p>Выберите объект на холсте, чтобы увидеть его координаты и размеры.</p>
            )
          ) : inspectorTab === 'layers' ? (
            <LayerPanel
              layers={canvasState.layers}
              selectedIds={canvasState.selectedIds}
              onSelect={(ids) => canvasRef.current?.selectLayers(ids)}
              onRename={(id, name) => canvasRef.current?.renameLayer(id, name)}
              onToggleVisibility={(id) => canvasRef.current?.toggleLayerVisibility(id)}
              onToggleLock={(id) => canvasRef.current?.toggleLayerLock(id)}
              onDuplicate={(id) => canvasRef.current?.duplicateLayer(id)}
              onDelete={(id) => {
                if (window.confirm('Удалить выбранный слой и его содержимое?')) {
                  canvasRef.current?.deleteLayer(id);
                }
              }}
              onMove={(id, direction) => canvasRef.current?.moveLayer(id, direction)}
              onReorder={(id, targetId) => canvasRef.current?.reorderLayer(id, targetId)}
              onGroup={(ids) => canvasRef.current?.groupLayers(ids)}
              onUngroup={(id) => canvasRef.current?.ungroupLayer(id)}
            />
          ) : inspectorTab === 'effects' && canvasState.selected?.image ? (
            <ImagePropertiesPanel
              mode="effects"
              layer={canvasState.selected}
              issue={canvasState.imageIssues[canvasState.selected.id]}
              onUpdate={(patch) =>
                canvasRef.current?.updateImageLayer(canvasState.selected!.id, patch)
              }
              onReplace={async (file) => {
                await canvasRef.current?.replaceImage(canvasState.selected!.id, file);
              }}
              onUploadMask={async (file) => {
                await canvasRef.current?.setSvgMask(canvasState.selected!.id, file);
              }}
            />
          ) : inspectorTab === 'effects' && canvasState.selected?.kind === 'text' ? (
            <TextPropertiesPanel
              mode="effects"
              layer={canvasState.selected}
              fonts={fontState.fonts}
              issue={canvasState.textIssues[canvasState.selected.id]}
              onUpdate={(patch) =>
                canvasRef.current?.updateTextLayer(canvasState.selected!.id, patch)
              }
              onUploadFont={async (file, family) => {
                await canvasRef.current?.uploadFont(file, family);
              }}
              onDeleteFont={async (fontId) => {
                await canvasRef.current?.deleteFont(fontId);
              }}
              onToggleFavorite={async (fontId, favorite) => {
                await canvasRef.current?.toggleFontFavorite(fontId, favorite);
              }}
            />
          ) : inspectorTab === 'bindings' ? (
            <div className="binding-panel">
              <span className="status-badge">Этап 8</span>
              <strong>
                {editMode === 'participant'
                  ? `Экземпляр: ${
                      selectedParticipant ? participantLabel(selectedParticipant) : 'участник'
                    }`
                  : 'Редактируется общий шаблон'}
              </strong>
              <p>
                {editMode === 'participant'
                  ? 'Изменения записываются как точечные overrides выбранного участника.'
                  : 'Изменения в шаблоне будут базой для всех участников. Для персональной правки выберите участника в верхней панели.'}
              </p>
              {canvasState.selected?.binding ? (
                <dl>
                  <div>
                    <dt>Источник</dt>
                    <dd>{canvasState.selected.binding.source}</dd>
                  </div>
                  <div>
                    <dt>Поле</dt>
                    <dd>{canvasState.selected.binding.field}</dd>
                  </div>
                  <div>
                    <dt>Fallback</dt>
                    <dd>{canvasState.selected.binding.fallback ?? '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p>
                  У выбранного слоя нет привязки. Привязки из шаблонов применяются автоматически.
                </p>
              )}
            </div>
          ) : (
            <p>Раздел будет подключён на соответствующем этапе. Сейчас он не имитирует работу.</p>
          )}
          <div
            className={`inspector-stage-actions ${canvasState.selected?.kind === 'text' || canvasState.selected?.image ? 'is-hidden' : ''}`}
          >
            <span>Сетка: {gridVisible ? 'включена' : 'скрыта'}</span>
            <span>Привязка: {snappingEnabled ? 'включена' : 'выключена'}</span>
            <Button variant="ghost" onClick={resetCanvas}>
              Сбросить демо-сцену
            </Button>
          </div>
        </div>
      </aside>

      <PageStrip
        groups={pageState.groups}
        activeGroupId={pageState.activeGroupId}
        layerCountByPage={pageState.layerCountByPage}
        layersByPage={pageState.layersByPage}
        onSelect={(id) => canvasRef.current?.selectPageGroup(id)}
        onAddPage={() => canvasRef.current?.addPage()}
        onAddSpread={() => canvasRef.current?.addSpread()}
        onDuplicate={(id) => canvasRef.current?.duplicatePageGroup(id)}
        onDelete={(id) => {
          if (window.confirm('Удалить страницу или разворот вместе со слоями?')) {
            canvasRef.current?.deletePageGroup(id);
          }
        }}
        onMove={(id, direction) => canvasRef.current?.movePageGroup(id, direction)}
      />
    </div>
  );
}
