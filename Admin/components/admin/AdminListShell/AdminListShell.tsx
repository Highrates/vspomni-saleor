'use client';

import type { ReactNode } from 'react';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import defaultStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

export function AdminListShell({
  loading,
  error,
  onRetry,
  retryLabel = 'Повторить',
  loadingLabel,
  empty,
  isEmpty,
  isFetching,
  toolbar,
  pagination,
  children,
  styles = defaultStyles,
  wrapContent = true,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  loadingLabel: string;
  empty?: ReactNode;
  isEmpty: boolean;
  isFetching?: boolean;
  toolbar?: ReactNode;
  pagination?: ReactNode;
  children: ReactNode;
  styles?: typeof defaultStyles;
  /** false — без tableWrap (кастомные секции). */
  wrapContent?: boolean;
}) {
  const fetchOpacity = isFetching ? { opacity: 0.65 } : undefined;

  return (
    <>
      {toolbar}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
          {onRetry ? (
            <>
              {' '}
              <AdminCompactBtn type="button" variant="outline" onClick={onRetry}>
                {retryLabel}
              </AdminCompactBtn>
            </>
          ) : null}
        </p>
      ) : null}
      {loading ? (
        <p className={styles.muted}>{loadingLabel}</p>
      ) : error ? null : isEmpty ? (
        empty ? (
          typeof empty === 'string' ? (
            <p className={styles.muted}>{empty}</p>
          ) : (
            empty
          )
        ) : null
      ) : wrapContent ? (
        <div className={styles.tableWrap} style={fetchOpacity}>
          {children}
        </div>
      ) : (
        <div style={fetchOpacity}>{children}</div>
      )}
      {pagination}
    </>
  );
}
