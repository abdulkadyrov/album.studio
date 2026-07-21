import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="not-found">
      <span className="status-badge">404</span>
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или вернитесь в локальное рабочее пространство.</p>
      <Link className="button button--primary" to="/projects">
        <ArrowLeft size={15} aria-hidden="true" />К проектам
      </Link>
    </main>
  );
}
