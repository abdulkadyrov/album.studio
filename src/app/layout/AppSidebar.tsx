import {
  BookImage,
  CheckCircle2,
  Download,
  FileUp,
  FolderKanban,
  LayoutTemplate,
  Lightbulb,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { IconButton } from '../../components/ui/IconButton';
import { previewProjectId, routes } from '../routes';
import { useUiStore } from '../../stores/ui-store';

const navigation = [
  { label: 'Проекты', to: routes.projects, icon: FolderKanban },
  { label: 'Шаблоны', to: routes.templates, icon: LayoutTemplate },
  { label: 'Участники', to: routes.participants(previewProjectId), icon: Users },
  { label: 'Импорт класса', to: routes.importClass(previewProjectId), icon: FileUp },
  { label: 'Референсы', to: routes.references(previewProjectId), icon: BookImage },
  { label: 'Идеи', to: routes.ideas(previewProjectId), icon: Lightbulb },
  { label: 'Аннотации', to: routes.annotations(previewProjectId), icon: MessageSquareText },
  { label: 'Проверка', to: routes.validation(previewProjectId), icon: CheckCircle2 },
  { label: 'Экспорт', to: routes.export(previewProjectId), icon: Download },
  { label: 'Настройки', to: routes.settings, icon: Settings },
] as const;

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          V
        </span>
        <span className="brand-copy">
          <strong>VAKHA</strong>
          <small>ALBUM DESIGNER</small>
        </span>
      </div>

      <nav className="primary-nav" aria-label="Основная навигация">
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === routes.projects || to === routes.templates || to === routes.settings}
            className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="profile">
          <span className="profile__avatar">VS</span>
          <span className="profile__copy">
            <strong>Vakha Studio</strong>
            <small>Локальный профиль</small>
          </span>
        </div>
        <IconButton
          label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
          icon={collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          onClick={toggleSidebar}
        />
      </div>
    </aside>
  );
}
