import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '../ui/Button';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <div>
        <strong>Доступно обновление</strong>
        <p>Сохраните работу и установите новую версию приложения.</p>
      </div>
      <Button
        variant="primary"
        icon={<RefreshCw size={15} />}
        onClick={() => void updateServiceWorker(true)}
      >
        Обновить
      </Button>
      <button
        className="update-prompt__close"
        aria-label="Закрыть уведомление"
        onClick={() => setNeedRefresh(false)}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
