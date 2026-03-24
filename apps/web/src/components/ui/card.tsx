import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}

export function Card({ children, header, className, padding = true, onClick }: CardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={clsx(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]',
        className,
      )}
    >
      {header && (
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          {typeof header === 'string' ? (
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {header}
            </h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className={clsx(padding && 'p-6')}>{children}</div>
    </div>
  );
}
