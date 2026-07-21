import { ExternalLink, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import type { CanvasDocument } from '../../canvas/model/canvas-document';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import {
  type ReferencePayload,
  type ReferenceStatus,
  type WorkspaceMaterial,
  workspaceMaterialsRepository,
} from '../../data/repositories/workspace-materials-repository';
import { referenceSourceLabels, referenceStatusLabels } from './material-labels';

type ReferenceMaterial = WorkspaceMaterial<ReferencePayload>;

const emptyForm = {
  title: '',
  url: '',
  notes: '',
  tags: '',
  sourceType: 'image' as ReferencePayload['sourceType'],
  category: 'mood',
  pageId: 'none',
  layerId: 'none',
  status: 'active' as ReferenceStatus,
  favorite: false,
};

function tagsLine(tags: string[]): string {
  return tags.join(', ');
}

export function ReferencesPage() {
  const { projectId = 'preview' } = useParams();
  const [document, setDocument] = useState<CanvasDocument>();
  const [items, setItems] = useState<ReferenceMaterial[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ReferenceStatus>('all');
  const [pageId, setPageId] = useState('all');
  const [editing, setEditing] = useState<ReferenceMaterial>();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const refresh = async () =>
    setItems(await workspaceMaterialsRepository.listReferences(projectId));

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canvasSceneRepository.load(projectId),
      workspaceMaterialsRepository.listReferences(projectId),
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
    await workspaceMaterialsRepository.saveReference(
      projectId,
      { ...form, tags: form.tags.split(',') },
      editing?.id,
    );
    setMessage(editing ? 'Референс обновлён' : 'Референс сохранён локально');
    setEditing(undefined);
    setForm(emptyForm);
    await refresh();
  };

  const edit = (item: ReferenceMaterial) => {
    setEditing(item);
    setForm({
      title: item.payload.title,
      url: item.payload.url ?? '',
      notes: item.payload.notes,
      tags: tagsLine(item.payload.tags),
      sourceType: item.payload.sourceType,
      category: item.category ?? 'mood',
      pageId: item.pageId ?? 'none',
      layerId: item.layerId ?? 'none',
      status: (item.status as ReferenceStatus | undefined) ?? 'active',
      favorite: item.favorite,
    });
  };

  const remove = async (id: string) => {
    await workspaceMaterialsRepository.deleteReference(id);
    setMessage('Референс удалён из рабочих материалов');
    await refresh();
  };

  return (
    <div className="page workspace-page" data-testid="references-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 10 · проект {projectId}</span>
          <h1>Референсы</h1>
          <p>
            Вдохновение, ссылки и заметки хранятся локально рядом с проектом и не участвуют в
            печатном рендере альбома.
          </p>
        </div>
        <Link className="button button--secondary" to={routes.editor(projectId)}>
          Открыть редактор
        </Link>
      </header>

      <div className="toolbar toolbar--filters workspace-filters">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск референсов</span>
          <input
            placeholder="Поиск референсов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Статус референса"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(referenceStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Страница референса"
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
          <h2>{editing ? 'Редактировать референс' : 'Новый референс'}</h2>
          <label className="text-field">
            <span>Название</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="text-field">
            <span>URL / источник</span>
            <input
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
            />
          </label>
          <label className="text-field">
            <span>Заметки</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
          <div className="text-field-grid text-field-grid--two">
            <label>
              <span>Тип</span>
              <select
                value={form.sourceType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    sourceType: event.target.value as ReferencePayload['sourceType'],
                  })
                }
              >
                {Object.entries(referenceSourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Категория</span>
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
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
                    {referenceStatusLabels[item.status as ReferenceStatus]} ·{' '}
                    {referenceSourceLabels[item.payload.sourceType]}
                  </span>
                  <h2>{item.payload.title}</h2>
                </div>
                {item.favorite ? <Star size={16} aria-label="Закреплено" /> : null}
              </header>
              <p>{item.payload.notes || 'Без заметок'}</p>
              <small>
                {item.category} · {item.payload.tags.join(', ') || 'без тегов'}
              </small>
              <footer>
                {item.payload.url ? (
                  <a className="text-link" href={item.payload.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Открыть
                  </a>
                ) : (
                  <span />
                )}
                <div>
                  <IconButton
                    label="Редактировать референс"
                    icon={<Pencil />}
                    onClick={() => edit(item)}
                  />
                  <IconButton
                    label="Удалить референс"
                    icon={<Trash2 />}
                    onClick={() => void remove(item.id)}
                  />
                </div>
              </footer>
            </article>
          ))}
          {filteredItems.length === 0 ? (
            <div className="workspace-empty">Референсов по текущим фильтрам нет.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
