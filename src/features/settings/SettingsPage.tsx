import { Check, Database, HardDrive, Palette } from 'lucide-react';

import { useDatabaseStatus } from '../../app/providers/database-status-context';
import { settingsRepository } from '../../data/repositories/settings-repository';
import { useUiStore, type Accent } from '../../stores/ui-store';

const accentOptions: Array<{ value: Accent; label: string; description: string }> = [
  { value: 'violet', label: 'Фиолетовый', description: 'Основной вариант утверждённого коллажа' },
  { value: 'blue', label: 'Синий', description: 'Альтернативный акцент первого коллажа' },
];

export function SettingsPage() {
  const databaseStatus = useDatabaseStatus();
  const accent = useUiStore((state) => state.accent);
  const setAccent = useUiStore((state) => state.setAccent);

  const chooseAccent = (value: Accent) => {
    const previousAccent = accent;
    setAccent(value);
    void settingsRepository.set('accent', value).catch(() => {
      setAccent(previousAccent);
    });
  };

  const databaseLabel = {
    opening: 'Открывается',
    ready: 'Готова',
    error: 'Ошибка',
  }[databaseStatus];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Приложение</span>
          <h1>Настройки</h1>
          <p>Базовые параметры хранятся локально на этом устройстве.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel__heading">
            <Palette size={18} aria-hidden="true" />
            <div>
              <h2>Акцент интерфейса</h2>
              <p>Оба варианта основаны на утверждённых коллажах.</p>
            </div>
          </div>
          <div className="accent-options" role="radiogroup" aria-label="Акцент интерфейса">
            {accentOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`accent-option ${accent === option.value ? 'is-selected' : ''}`}
                role="radio"
                aria-checked={accent === option.value}
                onClick={() => chooseAccent(option.value)}
              >
                <span className={`accent-swatch accent-swatch--${option.value}`} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                {accent === option.value ? <Check size={17} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel__heading">
            <Database size={18} aria-hidden="true" />
            <div>
              <h2>Локальная база</h2>
              <p>IndexedDB · схема v1</p>
            </div>
          </div>
          <dl className="status-list">
            <div>
              <dt>Состояние</dt>
              <dd className={`database-status database-status--${databaseStatus}`}>
                {databaseLabel}
              </dd>
            </div>
            <div>
              <dt>Сеть</dt>
              <dd>Не используется для проектов</dd>
            </div>
            <div>
              <dt>Ресурсы пользователя</dt>
              <dd>Только IndexedDB</dd>
            </div>
          </dl>
        </section>

        <section className="settings-panel settings-panel--wide">
          <div className="settings-panel__heading">
            <HardDrive size={18} aria-hidden="true" />
            <div>
              <h2>Параметры будущих проектов</h2>
              <p>
                DPI, вылеты, сетка, шрифты и резервные копии будут добавляться вместе с предметными
                модулями.
              </p>
            </div>
          </div>
          <span className="status-badge">Будет добавлено позже</span>
        </section>
      </div>
    </div>
  );
}
