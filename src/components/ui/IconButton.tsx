import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  comingSoon?: boolean;
}

export function IconButton({
  label,
  icon,
  active = false,
  comingSoon = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      title={comingSoon ? `${label} — будет добавлено позже` : label}
      {...props}
      disabled={props.disabled || comingSoon}
    >
      {icon}
    </button>
  );
}
