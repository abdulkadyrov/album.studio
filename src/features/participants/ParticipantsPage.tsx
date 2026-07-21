import { CheckSquare, FileUp, Search, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { routes } from '../../app/routes';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/Button';
import {
  participantRepository,
  type ParticipantWithPhotos,
} from '../../data/repositories/participant-repository';
import { participantStatusLabels, type ParticipantStatus } from './class-schema';

const allStatuses = Object.keys(participantStatusLabels) as ParticipantStatus[];

function participantName(participant: ParticipantWithPhotos): string {
  return (
    participant.displayName ||
    [participant.lastName, participant.firstName, participant.middleName].filter(Boolean).join(' ')
  );
}

export function ParticipantsPage() {
  const { projectId = 'preview' } = useParams();
  const [participants, setParticipants] = useState<ParticipantWithPhotos[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'student' | 'teacher'>('all');
  const [status, setStatus] = useState<'all' | ParticipantStatus>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setParticipants(await participantRepository.list(projectId));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void participantRepository.list(projectId).then((nextParticipants) => {
      if (!cancelled) setParticipants(nextParticipants);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = useMemo(
    () =>
      participants.filter((participant) => {
        const name = participantName(participant).toLocaleLowerCase('ru');
        return (
          name.includes(query.toLocaleLowerCase('ru')) &&
          (type === 'all' || participant.type === type) &&
          (status === 'all' || participant.status === status)
        );
      }),
    [participants, query, status, type],
  );

  const selectedFilteredIds = filtered
    .filter((person) => selectedIds.includes(person.id))
    .map((person) => person.id);
  const allFilteredSelected = filtered.length > 0 && selectedFilteredIds.length === filtered.length;

  const toggleAll = () => {
    setSelectedIds((current) =>
      allFilteredSelected
        ? current.filter((id) => !filtered.some((participant) => participant.id === id))
        : [...new Set([...current, ...filtered.map((participant) => participant.id)])],
    );
  };

  const setBulkStatus = async (nextStatus: ParticipantStatus) => {
    await participantRepository.updateStatus(projectId, selectedIds, nextStatus);
    setMessage(`Обновлено участников: ${selectedIds.length}`);
    setSelectedIds([]);
    await refresh();
  };

  const counts = participants.reduce(
    (acc, participant) => {
      acc.total += 1;
      acc[participant.type] += 1;
      if (participant.photos.length === 0) acc.withoutPhoto += 1;
      return acc;
    },
    { total: 0, student: 0, teacher: 0, withoutPhoto: 0 },
  );

  return (
    <div className="page participants-page" data-testid="participants-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Этап 7 · проект {projectId}</span>
          <h1>Участники</h1>
          <p>
            Ученики и учителя хранятся отдельно от шаблона, чтобы следующий этап мог строить
            персональные экземпляры без копирования проекта.
          </p>
        </div>
        <Link className="button button--primary" to={routes.importClass(projectId)}>
          <FileUp size={15} aria-hidden="true" />
          Импорт класса
        </Link>
      </header>

      <section className="participants-stats">
        <article>
          <span>Всего</span>
          <strong>{counts.total}</strong>
        </article>
        <article>
          <span>Ученики</span>
          <strong>{counts.student}</strong>
        </article>
        <article>
          <span>Учителя</span>
          <strong>{counts.teacher}</strong>
        </article>
        <article>
          <span>Без фото</span>
          <strong>{counts.withoutPhoto}</strong>
        </article>
      </section>

      <div className="toolbar toolbar--filters participants-filters">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Поиск участников</span>
          <input
            placeholder="Поиск участников"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Тип участника"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
        >
          <option value="all">Все типы</option>
          <option value="student">Ученики</option>
          <option value="teacher">Учителя</option>
        </select>
        <select
          aria-label="Статус участника"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Все статусы</option>
          {allStatuses.map((item) => (
            <option key={item} value={item}>
              {participantStatusLabels[item]}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <div className="catalog-message" role="status">
          {message}
        </div>
      ) : null}

      {participants.length === 0 ? (
        <EmptyState
          badge="Этап 7"
          title="Класс ещё не импортирован"
          description="Загрузите .vsclass, чтобы увидеть учеников, учителей, статусы и фото."
          action={
            <Link className="button button--primary" to={routes.importClass(projectId)}>
              Импорт класса
            </Link>
          }
        />
      ) : (
        <section className="participants-panel">
          <div className="participants-selection">
            <Button
              icon={allFilteredSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              onClick={toggleAll}
            >
              {allFilteredSelected ? 'Снять выбор' : 'Выбрать видимых'}
            </Button>
            <span>{selectedIds.length} выбрано</span>
            <select
              aria-label="Назначить статус выбранным"
              disabled={selectedIds.length === 0}
              defaultValue=""
              onChange={(event) => {
                const nextStatus = event.target.value as ParticipantStatus;
                if (nextStatus) void setBulkStatus(nextStatus);
                event.currentTarget.value = '';
              }}
            >
              <option value="" disabled>
                Назначить статус
              </option>
              {allStatuses.map((item) => (
                <option key={item} value={item}>
                  {participantStatusLabels[item]}
                </option>
              ))}
            </select>
          </div>

          <div className="participant-table" role="table" aria-label="Участники проекта">
            <div role="row" className="participant-table__head">
              <span>Выбор</span>
              <span>ФИО</span>
              <span>Тип</span>
              <span>Статус</span>
              <span>Фото</span>
            </div>
            {filtered.map((participant) => {
              const checked = selectedIds.includes(participant.id);
              return (
                <div role="row" key={participant.id}>
                  <label className="participant-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={`Выбрать ${participantName(participant)}`}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, participant.id]
                            : current.filter((id) => id !== participant.id),
                        )
                      }
                    />
                  </label>
                  <strong>{participantName(participant)}</strong>
                  <span>{participant.type === 'student' ? 'Ученик' : 'Учитель'}</span>
                  <select
                    aria-label={`Статус ${participantName(participant)}`}
                    value={participant.status}
                    onChange={(event) => {
                      void participantRepository
                        .updateStatus(projectId, [participant.id], event.target.value)
                        .then(refresh);
                    }}
                  >
                    {allStatuses.map((item) => (
                      <option key={item} value={item}>
                        {participantStatusLabels[item]}
                      </option>
                    ))}
                  </select>
                  <span>{participant.photos.length}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
