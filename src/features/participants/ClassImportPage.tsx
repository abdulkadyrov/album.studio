import { AlertTriangle, FileArchive, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import { Button } from '../../components/ui/Button';
import {
  classImportStrategyLabels,
  participantStatusLabels,
  type ClassImportStrategy,
} from './class-schema';
import {
  classImportRepository,
  type ClassImportPreview,
  type ClassImportResult,
} from '../../data/repositories/class-import-repository';

const strategies = Object.keys(classImportStrategyLabels) as ClassImportStrategy[];

export function ClassImportPage() {
  const { projectId = 'preview' } = useParams();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ClassImportPreview>();
  const [result, setResult] = useState<ClassImportResult>();
  const [strategy, setStrategy] = useState<ClassImportStrategy>('merge');
  const [message, setMessage] = useState('');

  const loadPreview = async (nextFile: File) => {
    setMessage('');
    setResult(undefined);
    setFile(nextFile);
    try {
      setPreview(await classImportRepository.preview(nextFile));
    } catch (error) {
      setPreview(undefined);
      setMessage(error instanceof Error ? error.message : 'Не удалось прочитать класс');
    }
  };

  const commitImport = async () => {
    if (!file) return;
    try {
      const nextResult = await classImportRepository.import(projectId, file, strategy);
      setResult(nextResult);
      setMessage(
        `Импортировано: ${nextResult.imported}, обновлено: ${nextResult.updated}, фото: ${nextResult.photos}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Импорт не выполнен');
    }
  };

  return (
    <div className="page class-import-page" data-testid="class-import-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 7 · проект {projectId}</span>
          <h1>Импорт класса</h1>
          <p>
            Пакет .vsclass проверяется локально и сначала открывается как preview без записи в
            проект.
          </p>
        </div>
        <Link className="button button--secondary" to={routes.participants(projectId)}>
          <Users size={15} aria-hidden="true" />
          Участники
        </Link>
      </header>

      <section className="class-import-dropzone">
        <FileArchive size={28} aria-hidden="true" />
        <div>
          <strong>Загрузите .vsclass</strong>
          <span>ZIP-архив с manifest.json и фотографиями в папке assets/.</span>
        </div>
        <label className="button button--primary">
          <Upload size={15} aria-hidden="true" />
          Выбрать файл
          <input
            className="sr-only"
            type="file"
            accept=".vsclass,application/zip"
            aria-label="Выбрать .vsclass"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void loadPreview(selected);
              event.target.value = '';
            }}
          />
        </label>
      </section>

      {message ? (
        <div className="catalog-message" role="status">
          {message}
        </div>
      ) : null}

      {preview ? (
        <section className="class-preview">
          <div className="class-preview__summary">
            <article>
              <span>Ученики</span>
              <strong>{preview.stats.students}</strong>
            </article>
            <article>
              <span>Учителя</span>
              <strong>{preview.stats.teachers}</strong>
            </article>
            <article>
              <span>Фото</span>
              <strong>{preview.stats.photos}</strong>
            </article>
            <article>
              <span>Размер</span>
              <strong>{Math.max(1, Math.round(preview.stats.bytes / 1024))} КБ</strong>
            </article>
          </div>

          <div className="class-import-controls">
            <div className="segmented-control" role="radiogroup" aria-label="Стратегия импорта">
              {strategies.map((item) => (
                <button
                  key={item}
                  className={strategy === item ? 'is-active' : ''}
                  type="button"
                  role="radio"
                  aria-checked={strategy === item}
                  onClick={() => setStrategy(item)}
                >
                  {classImportStrategyLabels[item]}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={commitImport}>
              Записать в проект
            </Button>
          </div>

          {preview.warnings.length > 0 ? (
            <ul className="class-warning-list" aria-label="Предупреждения импорта">
              {[...new Set(preview.warnings)].map((warning) => (
                <li key={warning}>
                  <AlertTriangle size={14} aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="participant-table participant-table--preview" role="table">
            <div role="row" className="participant-table__head">
              <span>Тип</span>
              <span>ФИО</span>
              <span>Статус</span>
              <span>Фото</span>
            </div>
            {preview.people.map((person, index) => (
              <div role="row" key={`${person.type}-${person.externalId ?? index}`}>
                <span>{person.type === 'student' ? 'Ученик' : 'Учитель'}</span>
                <strong>{person.displayName}</strong>
                <span>{participantStatusLabels[person.status]}</span>
                <span>{person.photoCount}</span>
              </div>
            ))}
          </div>

          {result ? (
            <Link className="button button--secondary" to={routes.participants(projectId)}>
              Открыть участников
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
