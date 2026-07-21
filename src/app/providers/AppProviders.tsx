import type { PropsWithChildren } from 'react';

import { DatabaseProvider } from './DatabaseProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { PwaUpdatePrompt } from '../../components/feedback/PwaUpdatePrompt';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary>
      <DatabaseProvider>
        {children}
        <PwaUpdatePrompt />
      </DatabaseProvider>
    </ErrorBoundary>
  );
}
