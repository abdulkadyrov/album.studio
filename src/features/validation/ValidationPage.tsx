import { AlertTriangle, CheckCircle2, ExternalLink, Info, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import { Button } from '../../components/ui/Button';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import { validateProjectDocument, type ValidationIssue } from './validation-service';
import type { CanvasDocument } from '../../canvas/model/canvas-document';

const severityLabels = {
  error: 'Ошибки',
  warning: 'Предупреждения',
  info: 'Инфо',
} as const;

const severityIcons = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

function issueTarget(document: CanvasDocument | undefined, issue: ValidationIssue): string {
  const page = document?.pages.find((candidate) => candidate.id === issue.pageId);
  const layer = document?.layers.find((candidate) => candidate.id === issue.layerId);
  return [page?.title, layer?.name].filter(Boolean).join(' · ') || 'Проект';
}

export function ValidationPage() {
  const { projectId = 'preview' } = useParams();
  const [document, setDocument] = useState<CanvasDocument>();
  const [report, setReport] = useState<Awaited<ReturnType<typeof validateProjectDocument>>>();
  const [filter, setFilter] = useState<'all' | ValidationIssue['severity']>('all');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nextDocument = await canvasSceneRepository.load(projectId);
      const nextReport = await validateProjectDocument(nextDocument);
      if (!cancelled) {
        setDocument(nextDocument);
        setReport(nextReport);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const issues = useMemo(
    () => report?.issues.filter((issue) => filter === 'all' || issue.severity === filter) ?? [],
    [filter, report?.issues],
  );

  return (
    <div className="page validation-page" data-testid="validation-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 9 · проект {projectId}</span>
          <h1>Проверка проекта</h1>
          <p>
            Ошибки блокируют только некорректный экспорт; предупреждения остаются решением
            пользователя.
          </p>
        </div>
        <div className="template-header-actions">
          <Link className="button button--secondary" to={routes.editor(projectId)}>
            <ExternalLink size={15} aria-hidden="true" />
            Открыть редактор
          </Link>
          <Button
            variant="primary"
            onClick={() => void validateProjectDocument(document).then(setReport)}
          >
            Проверить снова
          </Button>
        </div>
      </header>

      <section className="validation-summary">
        {(['error', 'warning', 'info'] as const).map((severity) => {
          const Icon = severityIcons[severity];
          return (
            <button
              key={severity}
              className={`validation-summary-card validation-summary-card--${severity} ${
                filter === severity ? 'is-active' : ''
              }`}
              type="button"
              onClick={() => setFilter(filter === severity ? 'all' : severity)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{severityLabels[severity]}</span>
              <strong>{report?.summary[severity] ?? 0}</strong>
            </button>
          );
        })}
        <div className={`validation-summary-card ${report?.canExport ? 'is-ok' : ''}`}>
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Экспорт</span>
          <strong>{report?.canExport ? 'Можно' : 'Блок'}</strong>
        </div>
      </section>

      <section className="validation-list" aria-label="Результаты проверки">
        {issues.length === 0 ? (
          <div className="validation-empty">
            <CheckCircle2 size={22} aria-hidden="true" />
            <strong>Проблем не найдено</strong>
            <span>Для выбранного фильтра нет замечаний.</span>
          </div>
        ) : (
          issues.map((issue) => {
            const Icon = severityIcons[issue.severity];
            return (
              <article
                key={issue.id}
                className={`validation-issue validation-issue--${issue.severity}`}
              >
                <Icon size={18} aria-hidden="true" />
                <div>
                  <strong>{issue.title}</strong>
                  <span>{issueTarget(document, issue)}</span>
                  <p>{issue.description}</p>
                </div>
                <Link className="button button--ghost" to={routes.editor(projectId)}>
                  Перейти
                </Link>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
