import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, header, className, padding = true }: CardProps) {
  return (
    <div
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
