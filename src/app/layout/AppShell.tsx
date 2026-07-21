import { Outlet } from 'react-router-dom';

import { AppSidebar } from './AppSidebar';
import { useUiStore } from '../../stores/ui-store';

export function AppShell() {
  const accent = useUiStore((state) => state.accent);

  return (
    <div className="app-shell" data-accent={accent}>
      <AppSidebar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
