import { Component, type PropsWithChildren, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="fatal-error" role="alert">
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <h1>Не удалось открыть приложение</h1>
          <p>Перезагрузите страницу. Локальные проекты не были удалены.</p>
          <button className="button button--primary" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
