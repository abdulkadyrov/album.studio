import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import type { CanvasDocument } from '../../canvas/model/canvas-document';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import {
  participantRepository,
  type ParticipantWithPhotos,
} from '../../data/repositories/participant-repository';
import {
  type AnnotationKind,
  type AnnotationPayload,
  type AnnotationStatus,
  type WorkspaceMaterial,
  workspaceMaterialsRepository,
} from '../../data/repositories/workspace-materials-repository';
import { annotationKindLabels, annotationStatusLabels } from './material-labels';

type AnnotationMaterial = WorkspaceMaterial<AnnotationPayload>;

const emptyForm = {
  title: '',
  body: '',
  kind: 'point' as AnnotationKind,
  tags: '',
  pageId: 'none',
  layerId: 'none',
  participantId: 'none',
  status: 'open' as AnnotationStatus,
  xMm: '0',
  yMm: '0',
  widthMm: '20',
  heightMm: '12',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function participantName(participant: ParticipantWithPhotos): string {
  return (
    participant.displayName ||
    [participant.lastName, participant.firstName, participant.middleName].filter(Boolean).join(' ')
  );
}

function optionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function AnnotationsPage() {
  const { projectId = 'preview' } = useParams();
  const [document, setDocument] = useState<CanvasDocument>();
  const [participants, setParticipants] = useState<ParticipantWithPhotos[]>([]);
  const [items, setItems] = useState<AnnotationMaterial[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | AnnotationStatus>('all');
  const [pageId, setPageId] = useState('all');
  const [editing, setEditing] = useState<AnnotationMaterial>();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const refresh = async () =>
    setItems(await workspaceMaterialsRepository.listAnnotations(projectId));

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canvasSceneRepository.load(projectId),
      participantRepository.list(projectId),
      workspaceMaterialsRepository.listAnnotations(projectId),
    ]).then(([nextDocument, nextParticipants, nextItems]) => {
      if (!cancelled) {
        setDocument(nextDocument);
        setParticipants(nextParticipants);
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

  const pageNames = useMemo(
    () => new Map(document?.pages.map((page) => [page.id, page.title]) ?? []),
    [document],
  );
  const layerNames = useMemo(
    () => new Map(document?.layers.map((layer) => [layer.id, layer.name]) ?? []),
    [document],
  );
  const participantNames = useMemo(
    () => new Map(participants.map((person) => [person.id, participantName(person)])),
    [participants],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    await workspaceMaterialsRepository.saveAnnotation(
      projectId,
      {
        ...form,
        tags: form.tags.split(','),
        xMm: optionalNumber(form.xMm),
        yMm: optionalNumber(form.yMm),
        widthMm: optionalNumber(form.widthMm),
        heightMm: optionalNumber(form.heightMm),
      },
      editing?.id,
    );
    setMessage(editing ? 'Аннотация обновлена' : 'Аннотация сохранена локально');
    setEditing(undefined);
    setForm(emptyForm);
    await refresh();
  };

  const edit = (item: AnnotationMaterial) => {
    setEditing(item);
    setForm({
      title: item.payload.title,
      body: item.payload.body,
      kind: item.payload.kind,
      tags: item.payload.tags.join(', '),
      pageId: item.pageId ?? 'none',
      layerId: item.layerId ?? 'none',
      participantId: item.participantId ?? 'none',
      status: (item.status as AnnotationStatus | undefined) ?? 'open',
      xMm: String(item.payload.xMm ?? 0),
      yMm: String(item.payload.yMm ?? 0),
      widthMm: String(item.payload.widthMm ?? 20),
      heightMm: String(item.payload.heightMm ?? 12),
    });
  };

  const remove = async (id: string) => {
    await workspaceMaterialsRepository.deleteAnnotation(id);
    setMessage('Аннотация удалена из рабочих материалов');
    await refresh();
  };

  const setItemStatus = async (id: string, nextStatus: AnnotationStatus) => {
    await workspaceMaterialsRepository.updateAnnotationStatus(id, nextStatus);
    setMessage(`Статус аннотации: ${annotationStatusLabels[nextStatus]}`);
    await refresh();
  };

  const exportAnnotations = async (format: 'json' | 'markdown') => {
    const blob = await workspaceMaterialsRepository.exportAnnotations(projectId, format);
    downloadBlob(blob, `annotations-${projectId}.${format === 'json' ? 'json' : 'md'}`);
    setMessage(`Аннотации экспортированы в ${format.toUpperCase()}`);
  };

  return (
    <div className="page workspace-page" data-testid="annotations-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 10 · проект {projectId}</span>
          <h1>Аннотации</h1>
          <p>
            Комментарии можно привязать к координате, области, слою или участнику. Они остаются
            рабочими материалами и экспортируются отдельно.
          </p>
        </div>
        <div className="template-header-actions">
          <Button icon={<Download size={15} />} onClick={() => void exportAnnotations('json')}>
            JSON
          </Button>
          <Button icon={<Download size={15} />} onClick={() => void exportAnnotations('markdown')}>
            Markdown
          </Button>
          <Link className="button button--secondary" to={routes.export(projectId)}>
            Экспорт альбома
          </Link>
        </div>
      </header>

      <div className="toolbar toolbar--filters workspace-filters">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск аннотаций</span>
          <input
            placeholder="Поиск аннотаций"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Статус аннотации"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(annotationStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Страница аннотации"
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

      <section className="workspace-layout workspace-layout--annotations">
        <form className="workspace-form" onSubmit={submit}>
          <h2>{editing ? 'Редактировать аннотацию' : 'Новая аннотация'}</h2>
          <label className="text-field">
            <span>Заголовок</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="text-field">
            <span>Комментарий</span>
            <textarea
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </label>
          <div className="text-field-grid text-field-grid--two">
            <label>
              <span>Тип</span>
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm({ ...form, kind: event.target.value as AnnotationKind })
                }
              >
                {Object.entries(annotationKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Статус</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as AnnotationStatus })
                }
              >
                {Object.entries(annotationStatusLabels).map(([value, label]) => (
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
            <label>
              <span>Участник</span>
              <select
                value={form.participantId}
                onChange={(event) => setForm({ ...form, participantId: event.target.value })}
              >
                <option value="none">Без участника</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participantName(participant)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Теги</span>
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
              />
            </label>
          </div>
          <div className="text-field-grid text-field-grid--four">
            <label>
              <span>X мм</span>
              <input
                type="number"
                value={form.xMm}
                onChange={(event) => setForm({ ...form, xMm: event.target.value })}
              />
            </label>
            <label>
              <span>Y мм</span>
              <input
                type="number"
                value={form.yMm}
                onChange={(event) => setForm({ ...form, yMm: event.target.value })}
              />
            </label>
            <label>
              <span>W мм</span>
              <input
                type="number"
                value={form.widthMm}
                onChange={(event) => setForm({ ...form, widthMm: event.target.value })}
              />
            </label>
            <label>
              <span>H мм</span>
              <input
                type="number"
                value={form.heightMm}
                onChange={(event) => setForm({ ...form, heightMm: event.target.value })}
              />
            </label>
          </div>
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

        <div className="workspace-table" role="table" aria-label="Аннотации проекта">
          <div role="row" className="workspace-table__head">
            <span>Аннотация</span>
            <span>Привязки</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>
          {filteredItems.map((item) => (
            <div role="row" key={item.id}>
              <div>
                <strong>{item.payload.title}</strong>
                <small>
                  {annotationKindLabels[item.payload.kind]} ·{' '}
                  {item.payload.tags.join(', ') || 'без тегов'}
                </small>
                {item.payload.body ? <p>{item.payload.body}</p> : null}
              </div>
              <small>
                {pageNames.get(item.pageId ?? '') ?? 'без страницы'}
                <br />
                {layerNames.get(item.layerId ?? '') ?? 'без слоя'}
                <br />
                {participantNames.get(item.participantId ?? '') ?? 'без участника'}
              </small>
              <select
                aria-label={`Статус аннотации ${item.payload.title}`}
                value={item.status}
                onChange={(event) =>
                  void setItemStatus(item.id, event.target.value as AnnotationStatus)
                }
              >
                {Object.entries(annotationStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="workspace-row-actions">
                <IconButton
                  label="Редактировать аннотацию"
                  icon={<Pencil />}
                  onClick={() => edit(item)}
                />
                <IconButton
                  label="Удалить аннотацию"
                  icon={<Trash2 />}
                  onClick={() => void remove(item.id)}
                />
              </div>
            </div>
          ))}
          {filteredItems.length === 0 ? (
            <div className="workspace-empty">Аннотаций по текущим фильтрам нет.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
