import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { database } from '../../data/db/database';
import { settingsRepository } from '../../data/repositories/settings-repository';
import { useUiStore } from '../../stores/ui-store';
import { DatabaseStatusContext, type DatabaseStatus } from './database-status-context';

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<DatabaseStatus>('opening');
  const setAccent = useUiStore((state) => state.setAccent);

  useEffect(() => {
    let active = true;

    const openDatabase = async () => {
      try {
        await database.open();
        const savedAccent = await settingsRepository.get('accent');
        if (savedAccent === 'blue' || savedAccent === 'violet') {
          setAccent(savedAccent);
        }
        if (active) setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    };

    void openDatabase();

    return () => {
      active = false;
    };
  }, [setAccent]);

  const value = useMemo(() => status, [status]);

  return <DatabaseStatusContext.Provider value={value}>{children}</DatabaseStatusContext.Provider>;
}
