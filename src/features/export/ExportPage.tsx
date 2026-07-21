import { Download, FileArchive, Play, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import { Button } from '../../components/ui/Button';
import { canvasSceneRepository } from '../../data/repositories/canvas-scene-repository';
import {
  participantRepository,
  type ParticipantWithPhotos,
} from '../../data/repositories/participant-repository';
import { albumRepository } from '../../data/repositories/album-repository';
import { validateProjectDocument, type ValidationReport } from '../validation/validation-service';
import { pageGroupsForExport } from './print-renderer';
import {
  runExportJob,
  saveExportHistory,
  type ExportFormat,
  type ExportProgress,
} from './export-service';
import type { CanvasDocument } from '../../canvas/model/canvas-document';

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

export function ExportPage() {
  const { projectId = 'preview' } = useParams();
  const [document, setDocument] = useState<CanvasDocument>();
  const [participants, setParticipants] = useState<ParticipantWithPhotos[]>([]);
  const [report, setReport] = useState<ValidationReport>();
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [dpi, setDpi] = useState(300);
  const [spread, setSpread] = useState(true);
  const [progress, setProgress] = useState<ExportProgress>();
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nextDocument = await canvasSceneRepository.load(projectId);
      const [nextParticipants, nextReport] = await Promise.all([
        participantRepository.list(projectId),
        validateProjectDocument(nextDocument),
      ]);
      if (!cancelled) {
        setDocument(nextDocument);
        setParticipants(nextParticipants);
        setReport(nextReport);
        const groups = nextDocument ? pageGroupsForExport(nextDocument) : [];
        setSelectedGroupIds(groups.map((group) => group.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const groups = useMemo(() => (document ? pageGroupsForExport(document) : []), [document]);
  const selectedGroups = groups.filter((group) => selectedGroupIds.includes(group.id));
  const canExport = Boolean(document && report?.canExport && selectedGroups.length > 0 && dpi > 0);

  const run = async () => {
    if (!document || !canExport) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setRunning(true);
    setMessage('');
    setProgress({ completed: 0, total: selectedGroups.length, currentLabel: 'Подготовка' });
    try {
      const result = await runExportJob(
        {
          projectId,
          document,
          groups: selectedGroups,
          participantIds: selectedParticipantIds,
          format,
          imageFormat,
          dpi,
          spread,
        },
        abort.signal,
        setProgress,
      );
      downloadBlob(result.blob, result.filename);
      setMessage(`Экспортировано страниц: ${result.pages}`);
      await saveExportHistory(projectId, 'completed', {
        format,
        imageFormat,
        dpi,
        spread,
        pages: result.pages,
        filename: result.filename,
      });
    } catch (error) {
      const cancelled = abort.signal.aborted;
      setMessage(
        cancelled ? 'Экспорт отменён' : error instanceof Error ? error.message : 'Ошибка экспорта',
      );
      await saveExportHistory(projectId, cancelled ? 'cancelled' : 'failed', {
        format,
        dpi,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      abortRef.current = undefined;
      setRunning(false);
    }
  };

  const backupAlbum = async () => {
    try {
      const result = await albumRepository.export(projectId);
      downloadBlob(result.blob, result.filename);
      setMessage(`Архив ${result.filename} создан`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось создать .vsalbum');
    }
  };

  return (
    <div className="page export-page" data-testid="export-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 9 · проект {projectId}</span>
          <h1>Экспорт</h1>
          <p>Файлы создаются локально. Размеры считаются по формуле millimeters / 25.4 × DPI.</p>
        </div>
        <div className="template-header-actions">
          <Link className="button button--secondary" to={routes.validation(projectId)}>
            Проверка
          </Link>
          <Button icon={<FileArchive size={15} />} onClick={backupAlbum}>
            .vsalbum
          </Button>
        </div>
      </header>

      <section className="export-grid">
        <article className="export-panel">
          <h2>1. Участники</h2>
          <label className="text-check">
            <input
              type="checkbox"
              checked={
                selectedParticipantIds.length === participants.length && participants.length > 0
              }
              onChange={(event) =>
                setSelectedParticipantIds(
                  event.target.checked ? participants.map((person) => person.id) : [],
                )
              }
            />
            <span>Все участники</span>
          </label>
          <div className="export-check-list">
            {participants.map((participant) => (
              <label key={participant.id}>
                <input
                  type="checkbox"
                  checked={selectedParticipantIds.includes(participant.id)}
                  onChange={(event) =>
                    setSelectedParticipantIds((current) =>
                      event.target.checked
                        ? [...current, participant.id]
                        : current.filter((id) => id !== participant.id),
                    )
                  }
                />
                <span>{participantName(participant)}</span>
              </label>
            ))}
            {participants.length === 0 ? <span>Будет экспортирован общий шаблон.</span> : null}
          </div>
        </article>

        <article className="export-panel">
          <h2>2. Страницы</h2>
          <label className="text-check">
            <input
              type="checkbox"
              checked={selectedGroupIds.length === groups.length && groups.length > 0}
              onChange={(event) =>
                setSelectedGroupIds(event.target.checked ? groups.map((group) => group.id) : [])
              }
            />
            <span>Все страницы и развороты</span>
          </label>
          <div className="export-check-list">
            {groups.map((group) => (
              <label key={group.id}>
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={(event) =>
                    setSelectedGroupIds((current) =>
                      event.target.checked
                        ? [...current, group.id]
                        : current.filter((id) => id !== group.id),
                    )
                  }
                />
                <span>{group.title}</span>
              </label>
            ))}
          </div>
        </article>

        <article className="export-panel">
          <h2>3. Формат</h2>
          <div className="segmented-control" role="radiogroup" aria-label="Формат экспорта">
            {(['pdf', 'png', 'jpeg', 'zip'] as ExportFormat[]).map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                className={format === item ? 'is-active' : ''}
                aria-checked={format === item}
                onClick={() => setFormat(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="text-field">
            <span>DPI</span>
            <select
              aria-label="DPI экспорта"
              value={dpi}
              onChange={(event) => setDpi(Number(event.target.value))}
            >
              <option value={150}>150</option>
              <option value={300}>300</option>
              <option value={450}>450</option>
            </select>
          </label>
          <label className="text-field">
            <span>ZIP images</span>
            <select
              aria-label="Формат изображений ZIP"
              value={imageFormat}
              onChange={(event) => setImageFormat(event.target.value as typeof imageFormat)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </label>
          <label className="text-check">
            <input
              type="checkbox"
              checked={spread}
              onChange={(event) => setSpread(event.target.checked)}
            />
            <span>Экспортировать развороты</span>
          </label>
        </article>
      </section>

      {report && !report.canExport ? (
        <div className="export-blocker" role="alert">
          Есть критические ошибки проверки. Исправьте их перед экспортом.
        </div>
      ) : null}

      {message ? (
        <div className="catalog-message" role="status">
          {message}
        </div>
      ) : null}

      <footer className="export-footer">
        {progress ? (
          <div className="export-progress">
            <span>{progress.currentLabel}</span>
            <progress value={progress.completed} max={progress.total} />
            <small>
              {progress.completed} / {progress.total}
            </small>
          </div>
        ) : null}
        {running ? (
          <Button icon={<Square size={15} />} onClick={() => abortRef.current?.abort()}>
            Отмена
          </Button>
        ) : (
          <Button variant="primary" icon={<Play size={15} />} disabled={!canExport} onClick={run}>
            Экспортировать
          </Button>
        )}
        <Button icon={<Download size={15} />} onClick={backupAlbum}>
          Резервная копия
        </Button>
      </footer>
    </div>
  );
}
