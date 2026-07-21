import { Construction } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  badge?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, badge, action }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <Construction size={22} />
      </span>
      {badge ? <span className="status-badge">{badge}</span> : null}
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
