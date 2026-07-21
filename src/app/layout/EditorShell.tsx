import {
  ArrowLeft,
  ChevronDown,
  Download,
  Frame,
  Hand,
  ImagePlus,
  Layers3,
  Link2,
  MousePointer2,
  Palette,
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
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { routes } from '../routes';
import { useUiStore } from '../../stores/ui-store';

const tools = [
  { label: 'Выделение', icon: MousePointer2, active: true },
  { label: 'Текст', icon: Type },
  { label: 'Фото', icon: ImagePlus },
  { label: 'Фоторамка', icon: Frame },
  { label: 'Фигура', icon: Shapes },
  { label: 'Декор', icon: Sparkles },
  { label: 'Фон', icon: Palette },
  { label: 'QR-код', icon: QrCode },
  { label: 'Таблица', icon: Table2 },
  { label: 'Рука', icon: Hand },
  { label: 'Масштаб', icon: ZoomIn },
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
          <span className="save-indicator">
            <i />
            Сохранено локально
          </span>
          <IconButton label="Отменить" icon={<Undo2 size={16} />} comingSoon />
          <IconButton label="Повторить" icon={<Redo2 size={16} />} comingSoon />
          <button className="zoom-control" type="button" disabled title="Будет добавлено позже">
            73% <ChevronDown size={13} />
          </button>
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
        {tools.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            className={`tool-button ${active ? 'is-active' : ''}`}
            type="button"
            aria-label={label}
            title={active ? label : `${label} — будет добавлено позже`}
            disabled={!active}
          >
            <Icon size={18} strokeWidth={1.65} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
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
        <section className="canvas-stage" aria-label="Область будущего холста">
          <div className="spread-placeholder">
            <div className="spread-placeholder__page">
              <span className="canvas-kicker">VAKHA ALBUM DESIGNER</span>
              <strong>Обложка</strong>
              <p>Логический холст будет подключён на этапе 2</p>
              <span className="safe-zone" aria-hidden="true" />
            </div>
            <div className="spread-placeholder__page spread-placeholder__page--right">
              <span className="canvas-kicker">ПРОЕКТ СОХРАНЯЕТСЯ ЛОКАЛЬНО</span>
              <strong>Новый альбом</strong>
              <p>Выберите инструмент после подключения canvas engine</p>
              <span className="safe-zone" aria-hidden="true" />
            </div>
          </div>
        </section>
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
          <span className="status-badge">Этап 2–5</span>
          <h2>{inspectorTabs.find((tab) => tab.id === inspectorTab)?.label}</h2>
          <p>
            Панель подключена и готова к предметным контролам. Неработающие свойства не имитируются.
          </p>
          <div className="inspector-skeleton" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
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
