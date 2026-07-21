import { CheckCircle2, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import type { CanvasDocument } from '../../canvas/model/canvas-document';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import {
  type IdeaPayload,
  type IdeaStatus,
  type WorkspaceMaterial,
  workspaceMaterialsRepository,
} from '../../data/repositories/workspace-materials-repository';
import { ideaPriorityLabels, ideaStatusLabels } from './material-labels';

type IdeaMaterial = WorkspaceMaterial<IdeaPayload>;

const emptyForm = {
  title: '',
  description: '',
  tags: '',
  priority: 'normal' as IdeaPayload['priority'],
  category: 'layout',
  pageId: 'none',
  layerId: 'none',
  status: 'draft' as IdeaStatus,
  favorite: false,
};

export function IdeasPage() {
  const { projectId = 'preview' } = useParams();
  const [document, setDocument] = useState<CanvasDocument>();
  const [items, setItems] = useState<IdeaMaterial[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | IdeaStatus>('all');
  const [pageId, setPageId] = useState('all');
  const [editing, setEditing] = useState<IdeaMaterial>();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const refresh = async () => setItems(await workspaceMaterialsRepository.listIdeas(projectId));

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canvasSceneRepository.load(projectId),
      workspaceMaterialsRepository.listIdeas(projectId),
    ]).then(([nextDocument, nextItems]) => {
      if (!cancelled) {
        setDocument(nextDocument);
        setItems(nextItems);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const layers = useMemo(
    () =>
      document?.layers.filter((layer) => form.pageId === 'none' || layer.pageId === form.pageId) ??
      [],
    [document, form.pageId],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const haystack = JSON.stringify(item).toLocaleLowerCase('ru');
        return (
          haystack.includes(query.trim().toLocaleLowerCase('ru')) &&
          (status === 'all' || item.status === status) &&
          (pageId === 'all' || item.pageId === pageId)
        );
      }),
    [items, pageId, query, status],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    await workspaceMaterialsRepository.saveIdea(
      projectId,
      { ...form, tags: form.tags.split(',') },
      editing?.id,
    );
    setMessage(editing ? 'Идея обновлена' : 'Идея сохранена локально');
    setEditing(undefined);
    setForm(emptyForm);
    await refresh();
  };

  const edit = (item: IdeaMaterial) => {
    setEditing(item);
    setForm({
      title: item.payload.title,
      description: item.payload.description,
      tags: item.payload.tags.join(', '),
      priority: item.payload.priority,
      category: item.category ?? 'layout',
      pageId: item.pageId ?? 'none',
      layerId: item.layerId ?? 'none',
      status: (item.status as IdeaStatus | undefined) ?? 'draft',
      favorite: item.favorite,
    });
  };

  const remove = async (id: string) => {
    await workspaceMaterialsRepository.deleteIdea(id);
    setMessage('Идея удалена из рабочих материалов');
    await refresh();
  };

  const selectIdea = async (item: IdeaMaterial) => {
    await workspaceMaterialsRepository.saveIdea(
      projectId,
      {
        ...item.payload,
        category: item.category,
        pageId: item.pageId,
        layerId: item.layerId,
        status: 'selected',
        favorite: item.favorite,
      },
      item.id,
    );
    setMessage('Идея переведена в работу');
    await refresh();
  };

  return (
    <div className="page workspace-page" data-testid="ideas-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 10 · проект {projectId}</span>
          <h1>Идеи</h1>
          <p>
            Концепции, варианты разворотов и творческие решения можно привязать к странице или слою,
            не загрязняя сам альбом.
          </p>
        </div>
        <Link className="button button--secondary" to={routes.references(projectId)}>
          Референсы
        </Link>
      </header>

      <div className="toolbar toolbar--filters workspace-filters">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск идей</span>
          <input
            placeholder="Поиск идей"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Статус идеи"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(ideaStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Страница идеи"
          value={pageId}
          onChange={(event) => setPageId(event.target.value)}
        >
          <option value="all">Все страницы</option>
          {document?.pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <div className="catalog-message" role="status">
          {message}
        </div>
      ) : null}

      <section className="workspace-layout">
        <form className="workspace-form" onSubmit={submit}>
          <h2>{editing ? 'Редактировать идею' : 'Новая идея'}</h2>
          <label className="text-field">
            <span>Название</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="text-field">
            <span>Описание</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div className="text-field-grid text-field-grid--two">
            <label>
              <span>Статус</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as IdeaStatus })}
              >
                {Object.entries(ideaStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Приоритет</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priority: event.target.value as IdeaPayload['priority'],
                  })
                }
              >
                {Object.entries(ideaPriorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Страница</span>
              <select
                value={form.pageId}
                onChange={(event) =>
                  setForm({ ...form, pageId: event.target.value, layerId: 'none' })
                }
              >
                <option value="none">Без привязки</option>
                {document?.pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Слой</span>
              <select
                value={form.layerId}
                onChange={(event) => setForm({ ...form, layerId: event.target.value })}
              >
                <option value="none">Без слоя</option>
                {layers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-field">
            <span>Категория</span>
            <input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
          </label>
          <label className="text-field">
            <span>Теги через запятую</span>
            <input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
          </label>
          <label className="text-check">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(event) => setForm({ ...form, favorite: event.target.checked })}
            />
            <span>Закрепить</span>
          </label>
          <footer>
            <Button variant="primary" icon={<Plus size={15} />}>
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
            {editing ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setForm(emptyForm);
                }}
              >
                Отмена
              </Button>
            ) : null}
          </footer>
        </form>

        <div className="workspace-card-grid">
          {filteredItems.map((item) => (
            <article key={item.id} className="workspace-card">
              <header>
                <div>
                  <span>
                    {ideaStatusLabels[item.status as IdeaStatus]} ·{' '}
                    {ideaPriorityLabels[item.payload.priority]}
                  </span>
                  <h2>{item.payload.title}</h2>
                </div>
                {item.favorite ? <Star size={16} aria-label="Закреплено" /> : null}
              </header>
              <p>{item.payload.description || 'Без описания'}</p>
              <small>
                {item.category} · {item.payload.tags.join(', ') || 'без тегов'}
              </small>
              <footer>
                <Button
                  type="button"
                  icon={<CheckCircle2 size={15} />}
                  disabled={item.status === 'selected'}
                  onClick={() => void selectIdea(item)}
                >
                  В работу
                </Button>
                <div>
                  <IconButton
                    label="Редактировать идею"
                    icon={<Pencil />}
                    onClick={() => edit(item)}
                  />
                  <IconButton
                    label="Удалить идею"
                    icon={<Trash2 />}
                    onClick={() => void remove(item.id)}
                  />
                </div>
              </footer>
            </article>
          ))}
          {filteredItems.length === 0 ? (
            <div className="workspace-empty">Идей по текущим фильтрам нет.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
