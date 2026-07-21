import { Grid2X2, List, Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';

export function ProjectsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <div className="page" data-testid="projects-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Рабочее пространство</span>
          <h1>Проекты</h1>
          <p>Локальные выпускные альбомы появятся здесь после создания.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} comingSoon>
          Новый проект
        </Button>
      </header>

      <div className="toolbar" aria-label="Управление проектами">
        <label className="search-field" title="Будет доступно после создания проектов">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск проектов</span>
          <input placeholder="Поиск проектов" disabled />
        </label>
        <span className="toolbar__spacer" />
        <span className="toolbar__label">Вид</span>
        <IconButton
          label="Сетка"
          icon={<Grid2X2 size={16} />}
          active={view === 'grid'}
          onClick={() => setView('grid')}
        />
        <IconButton
          label="Список"
          icon={<List size={17} />}
          active={view === 'list'}
          onClick={() => setView('list')}
        />
      </div>

      <EmptyState
        badge="Фундамент готов"
        title="Проектов пока нет"
        description="Создание, импорт, дублирование и автосохранение проектов будут подключены последовательными этапами. Сейчас доступна проверка оболочки и навигации."
        action={
          <Button icon={<Plus size={16} />} comingSoon>
            Создать первый проект
          </Button>
        }
      />

      <section className="foundation-grid" aria-label="Состояние фундамента">
        <article className="foundation-card">
          <span>01</span>
          <h2>Локальное хранение</h2>
          <p>IndexedDB v1 открывается на устройстве и не отправляет данные в сеть.</p>
        </article>
        <article className="foundation-card">
          <span>02</span>
          <h2>Офлайн-оболочка</h2>
          <p>PWA кэширует только файлы приложения, не содержимое будущих проектов.</p>
        </article>
        <article className="foundation-card">
          <span>03</span>
          <h2>Модульная основа</h2>
          <p>Маршруты и разделы готовы к независимой реализации следующих этапов.</p>
        </article>
      </section>
    </div>
  );
}
