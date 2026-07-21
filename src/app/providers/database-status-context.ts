import { createContext, useContext } from 'react';

export type DatabaseStatus = 'opening' | 'ready' | 'error';

export const DatabaseStatusContext = createContext<DatabaseStatus>('opening');

export function useDatabaseStatus() {
  return useContext(DatabaseStatusContext);
}
