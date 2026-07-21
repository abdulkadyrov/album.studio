import {
  Copy,
  Download,
  FilePlus2,
  Heart,
  Import,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createDefaultCanvasDocument } from '../../canvas/model/canvas-document';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { templateRepository } from '../../data/repositories/template-repository';
import { routes } from '../../app/routes';
import {
  templateCategoryLabels,
  templateStyleLabels,
  type TemplateCategory,
  type TemplateColor,
  type TemplateManifest,
  type TemplateStyle,
} from './template-schema';

const colorLabels: Record<TemplateColor, string> = {
  light: 'Светлые',
  dark: 'Тёмные',
  red: 'Красные',
  blue: 'Синие',
  green: 'Зелёные',
  gold: 'Золотые',
  multicolor: 'Многоцветные',
};

function pagePreviewLayers(template: TemplateManifest, pageId: string) {
  return template.document.layers
    .filter((layer) => layer.pageId === pageId && layer.kind !== 'group')
    .sort((left, right) => left.zIndex - right.zIndex);
}

function TemplatePagePreview({ template, pageId }: { template: TemplateManifest; pageId: string }) {
  const page = template.document.pages.find((candidate) => candidate.id === pageId)!;
  return (
    <div
      className="template-page-preview"
      style={{ aspectRatio: `${page.widthMm} / ${page.heightMm}` }}
      aria-label={page.title}
    >
      {pagePreviewLayers(template, pageId).map((layer) => {
        const style = {
          left: `${(layer.xMm / page.widthMm) * 100}%`,
          top: `${(layer.yMm / page.heightMm) * 100}%`,
          width: `${(layer.widthMm / page.widthMm) * 100}%`,
          height: `${(layer.heightMm / page.heightMm) * 100}%`,
          background: layer.kind === 'text' ? 'transparent' : layer.fill,
          color: layer.fill,
          borderColor: layer.stroke,
          borderRadius:
            layer.image?.frameShape === 'circle'
              ? '50%'
              : layer.image?.frameShape === 'rounded'
                ? '10%'
                : '1px',
          transform: `rotate(${layer.rotationDeg}deg)`,
          opacity: layer.opacity,
        };
        return layer.kind === 'text' ? (
          <span
            key={layer.id}
            className="template-page-preview__text"
            style={{
              ...style,
              fontFamily: layer.text?.fontFamily,
              fontSize: `${Math.max(5, (layer.text?.fontSizePt ?? 12) / 3.8)}px`,
              fontWeight: layer.text?.fontWeight,
              textAlign: layer.text?.textAlign,
            }}
          >
            {layer.text?.content}
          </span>
        ) : (
          <i key={layer.id} className={layer.kind === 'frame' ? 'is-frame' : ''} style={style} />
        );
      })}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<TemplateManifest[]>([]);
  const [selected, setSelected] = useState<TemplateManifest>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [style, setStyle] = useState<TemplateStyle | 'all'>('all');
  const [color, setColor] = useState<TemplateColor | 'all'>('all');
  const [origin, setOrigin] = useState<'all' | 'favorites' | 'user'>('all');
  const [message, setMessage] = useState('');

  const refresh = async () => setTemplates(await templateRepository.list());
  useEffect(() => {
    void templateRepository.list().then(setTemplates);
  }, []);

  const filtered = useMemo(
    () =>
      templates.filter((template) => {
        const meta = template.template;
        return (
          meta.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')) &&
          (category === 'all' || meta.category === category) &&
          (style === 'all' || meta.style === style) &&
          (color === 'all' || meta.color === color) &&
          (origin === 'all' ||
            (origin === 'favorites' && meta.favorite) ||
            (origin === 'user' && meta.source !== 'system'))
        );
      }),
    [category, color, origin, query, style, templates],
  );

  const createProject = async (templateId: string) => {
    const projectId = await templateRepository.createProject(templateId);
    await navigate(routes.editor(projectId));
  };

  const createBlankTemplate = async () => {
    const name = window.prompt('Название пустого шаблона', 'Новый шаблон')?.trim();
    if (!name) return;
    const document = createDefaultCanvasDocument(`blank-${crypto.randomUUID()}`);
    document.layers = [];
    await templateRepository.saveFromDocument(document, {
      name,
      description: 'Пустой пользовательский шаблон',
      category: 'general',
      style: 'minimal',
      color: 'light',
      scope: 'project',
    });
    setMessage('Пустой шаблон создан локально');
    await refresh();
  };

  return (
    <div className="page templates-catalog" data-testid="templates-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Редактируемые макеты · этап 6</span>
          <h1>Каталог шаблонов</h1>
          <p>Страницы, слои, шрифты и ресурсы хранятся локально и остаются редактируемыми.</p>
        </div>
        <div className="template-header-actions">
          <Button icon={<Import size={15} />} onClick={() => importRef.current?.click()}>
            Импорт
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={createBlankTemplate}>
            Пустой шаблон
          </Button>
          <input
            ref={importRef}
            className="sr-only"
            aria-label="Импортировать шаблон"
            type="file"
            accept=".vstemplate,application/zip"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void templateRepository
                  .import(file)
                  .then(async (manifest) => {
                    setMessage(`Шаблон «${manifest.template.name}» импортирован`);
                    await refresh();
                  })
                  .catch((error: unknown) =>
                    setMessage(error instanceof Error ? error.message : 'Ошибка импорта'),
                  );
              }
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="toolbar toolbar--filters template-filters">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск шаблонов</span>
          <input
            placeholder="Поиск шаблонов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Категория шаблона"
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
        >
          <option value="all">Все категории</option>
          {Object.entries(templateCategoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Стиль шаблона"
          value={style}
          onChange={(event) => setStyle(event.target.value as typeof style)}
        >
          <option value="all">Все стили</option>
          {Object.entries(templateStyleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Цвет шаблона"
          value={color}
          onChange={(event) => setColor(event.target.value as typeof color)}
        >
          <option value="all">Все цвета</option>
          {Object.entries(colorLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Источник шаблона"
          value={origin}
          onChange={(event) => setOrigin(event.target.value as typeof origin)}
        >
          <option value="all">Все шаблоны</option>
          <option value="favorites">Избранные</option>
          <option value="user">Созданные мной</option>
        </select>
      </div>

      {message ? (
        <div className="catalog-message" role="status">
          {message}
        </div>
      ) : null}
      <div className="template-result-meta">Найдено: {filtered.length}</div>

      <section className="template-grid" aria-label="Шаблоны">
        {filtered.map((template) => {
          const meta = template.template;
          const cover = template.document.pages[0]!;
          return (
            <article className="template-card" key={meta.id}>
              <button
                className="template-card__preview"
                type="button"
                onClick={() => setSelected(template)}
              >
                <TemplatePagePreview template={template} pageId={cover.id} />
                <span>{template.document.pages.length} стр.</span>
              </button>
              <div className="template-card__body">
                <div>
                  <strong>{meta.name}</strong>
                  <small>
                    {templateCategoryLabels[meta.category]} · {templateStyleLabels[meta.style]}
                  </small>
                </div>
                <IconButton
                  label={
                    meta.favorite ? `Убрать из избранного ${meta.name}` : `В избранное ${meta.name}`
                  }
                  icon={<Heart size={14} fill={meta.favorite ? 'currentColor' : 'none'} />}
                  active={meta.favorite}
                  onClick={() =>
                    void templateRepository.setFavorite(meta.id, !meta.favorite).then(refresh)
                  }
                />
              </div>
              <div className="template-card__actions">
                <Button variant="primary" onClick={() => void createProject(meta.id)}>
                  Создать проект
                </Button>
                <IconButton
                  label={`Предпросмотр ${meta.name}`}
                  icon={<FilePlus2 size={14} />}
                  onClick={() => setSelected(template)}
                />
                <IconButton
                  label={`Дублировать ${meta.name}`}
                  icon={<Copy size={14} />}
                  onClick={() => void templateRepository.duplicate(meta.id).then(refresh)}
                />
              </div>
            </article>
          );
        })}
      </section>

      {filtered.length === 0 ? (
        <div className="template-empty">По выбранным фильтрам шаблоны не найдены.</div>
      ) : null}

      {selected ? (
        <div
          className="template-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSelected(undefined)}
        >
          <section
            className="template-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Предпросмотр ${selected.template.name}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {selected.template.source === 'system'
                    ? 'Системный шаблон'
                    : selected.template.source === 'codex'
                      ? 'Создан Codex'
                      : 'Пользовательский шаблон'}
                </span>
                <h2>{selected.template.name}</h2>
                <p>{selected.template.description}</p>
              </div>
              <IconButton
                label="Закрыть предпросмотр"
                icon={<X size={17} />}
                onClick={() => setSelected(undefined)}
              />
            </header>
            <div className="template-dialog__pages">
              {selected.document.pages.map((page) => (
                <figure key={page.id}>
                  <TemplatePagePreview template={selected} pageId={page.id} />
                  <figcaption>
                    {page.title} · {page.pageType ?? 'universal'}
                    {page.repeatFor && page.repeatFor !== 'none'
                      ? ` · repeatFor: ${page.repeatFor}`
                      : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
            <footer>
              <Button variant="primary" onClick={() => void createProject(selected.template.id)}>
                Создать независимый проект
              </Button>
              <Button
                icon={<Download size={14} />}
                onClick={() =>
                  void templateRepository
                    .export(selected.template.id)
                    .then((blob) => downloadBlob(blob, `${selected.template.name}.vstemplate`))
                }
              >
                Экспортировать
              </Button>
              <Button
                icon={<Pencil size={14} />}
                onClick={() => void createProject(selected.template.id)}
              >
                Редактировать копию
              </Button>
              {selected.template.source !== 'system' ? (
                <>
                  <Button
                    onClick={() => {
                      const name = window.prompt('Новое название', selected.template.name)?.trim();
                      if (name)
                        void templateRepository
                          .rename(selected.template.id, name)
                          .then(async () => {
                            setSelected(undefined);
                            await refresh();
                          });
                    }}
                  >
                    Переименовать
                  </Button>
                  <Button
                    variant="ghost"
                    className="button--danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      if (
                        window.confirm('Удалить пользовательский шаблон и его локальные ресурсы?')
                      )
                        void templateRepository.delete(selected.template.id).then(async () => {
                          setSelected(undefined);
                          await refresh();
                        });
                    }}
                  >
                    Удалить
                  </Button>
                </>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
