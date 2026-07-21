import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  comingSoon?: boolean;
}

export function Button({
  children,
  className = '',
  icon,
  variant = 'secondary',
  comingSoon = false,
  title,
  ...props
}: ButtonProps) {
  const disabled = props.disabled || comingSoon;

  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      title={comingSoon ? 'Будет добавлено позже' : title}
      {...props}
      disabled={disabled}
    >
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
