import { clsx } from 'clsx';
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[var(--color-border)]">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--color-border)]">{children}</tbody>;
}

interface TableRowProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function TableRow({ children, onClick, className }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-[var(--color-bg-elevated)]',
        className,
      )}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export function TableHead({ children, className, ...props }: TableHeadProps) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({ children, className, ...props }: TableCellProps) {
  return (
    <td
      className={clsx(
        'px-4 py-3 text-[var(--color-text-secondary)]',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
