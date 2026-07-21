import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '../../components/feedback/EmptyState';
import { routes } from '../../app/routes';

interface ProjectSectionPageProps {
  title: string;
  description: string;
  milestone: string;
}

export function ProjectSectionPage({ title, description, milestone }: ProjectSectionPageProps) {
  const { projectId = 'preview' } = useParams();

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <div>
          <span className="eyebrow">Проект · {projectId}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Link className="button button--secondary" to={routes.editor(projectId)}>
          <ExternalLink size={15} aria-hidden="true" />
          Открыть оболочку редактора
        </Link>
      </header>
      <EmptyState
        badge={milestone}
        title="Раздел подключён к маршрутизации"
        description="Функция пока отключена и не выдаётся за работающую. Она будет добавлена на соответствующем этапе после прохождения проверок зависимых модулей."
        action={
          <Link className="text-link" to={routes.projects}>
            <ArrowLeft size={14} aria-hidden="true" />
            Вернуться к проектам
          </Link>
        }
      />
    </div>
  );
}
