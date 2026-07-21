import { Filter, Plus, Search } from 'lucide-react';

import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/Button';

export function TemplatesPage() {
  return (
    <div className="page" data-testid="templates-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Библиотека макетов</span>
          <h1>Каталог шаблонов</h1>
          <p>Системные и пользовательские шаблоны будут храниться локально.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} comingSoon>
          Пустой шаблон
        </Button>
      </header>

      <div className="toolbar toolbar--filters">
        <Button icon={<Filter size={15} />} comingSoon>
          Все категории
        </Button>
        <Button comingSoon>Все стили</Button>
        <Button comingSoon>Все цвета</Button>
        <label className="search-field" title="Будет добавлено на этапе шаблонов">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск шаблонов</span>
          <input placeholder="Поиск шаблонов" disabled />
        </label>
      </div>

      <EmptyState
        badge="Этап 6"
        title="Каталог подготовлен к наполнению"
        description="Просмотр, фильтры, избранное и создание проекта из шаблона будут реализованы после холста, слоёв, текста и изображений."
      />
    </div>
  );
}
