import { Grid2X2, List, Pencil, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { routes } from '../../app/routes';
import { projectRepository } from '../../data/repositories/project-repository';
import type { ProjectRecord } from '../../data/db/schema';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const refresh = async () => setProjects(await projectRepository.list());
  useEffect(() => {
    void projectRepository.list().then(setProjects);
  }, []);
  const filtered = useMemo(
    () =>
      projects.filter((project) =>
        project.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')),
      ),
    [projects, query],
  );

  return (
    <div className="page" data-testid="projects-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Рабочее пространство</span>
          <h1>Проекты</h1>
          <p>Локальные выпускные альбомы, созданные из каталога шаблонов.</p>
        </div>
        <Button variant="primary" onClick={() => navigate(routes.templates)}>
          Создать из шаблона
        </Button>
      </header>

      <div className="toolbar" aria-label="Управление проектами">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск проектов</span>
          <input
            placeholder="Поиск проектов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="toolbar__spacer" />
        <span className="toolbar__label">{filtered.length} пр.</span>
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

      {filtered.length === 0 ? (
        <EmptyState
          badge={projects.length === 0 ? 'Локально' : 'Нет совпадений'}
          title={projects.length === 0 ? 'Проектов пока нет' : 'Ничего не найдено'}
          description={
            projects.length === 0
              ? 'Выберите системный или пользовательский шаблон — исходный шаблон останется неизменным.'
              : 'Измените запрос поиска.'
          }
          action={
            projects.length === 0 ? (
              <Button onClick={() => navigate(routes.templates)}>Открыть каталог</Button>
            ) : undefined
          }
        />
      ) : (
        <section
          className={`project-library project-library--${view}`}
          aria-label="Локальные проекты"
        >
          {filtered.map((project) => (
            <article
              key={project.id}
              className="project-library-card"
              onDoubleClick={() => navigate(routes.editor(project.id))}
            >
              <button
                className="project-library-card__preview"
                type="button"
                onClick={() => navigate(routes.editor(project.id))}
              >
                <span>V</span>
              </button>
              <div className="project-library-card__body">
                <strong>{project.name}</strong>
                <small>
                  {project.academicYear} · изменён{' '}
                  {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                </small>
              </div>
              <div className="project-library-card__actions">
                <Button variant="primary" onClick={() => navigate(routes.editor(project.id))}>
                  Открыть
                </Button>
                <IconButton
                  label={`Переименовать ${project.name}`}
                  icon={<Pencil size={14} />}
                  onClick={() => {
                    const name = window.prompt('Название проекта', project.name)?.trim();
                    if (name) void projectRepository.rename(project.id, name).then(refresh);
                  }}
                />
                <IconButton
                  label={`Удалить ${project.name}`}
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    if (window.confirm('Удалить проект и его локальные ресурсы?'))
                      void projectRepository.delete(project.id).then(refresh);
                  }}
                />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
