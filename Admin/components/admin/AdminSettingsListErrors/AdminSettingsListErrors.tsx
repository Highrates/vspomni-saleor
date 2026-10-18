'use client';

import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

/** loadError — Retry; actionError — только dismiss (не зовёт load и не затирает draft). */
export function AdminSettingsListErrors({
  loadError,
  actionError,
  onRetry,
  onDismissLoad,
  onDismissAction,
}: {
  loadError: string | null;
  actionError: string | null;
  onRetry: () => void;
  onDismissLoad: () => void;
  onDismissAction: () => void;
}) {
  return (
    <>
      {loadError ? (
        <div className={catalogStyles.errorBanner} role="alert">
          <span>{loadError}</span>
          <AdminCompactBtn type="button" variant="outline" onClick={onRetry}>
            Повторить
          </AdminCompactBtn>
          <button
            type="button"
            className={catalogStyles.errorBannerDismiss}
            onClick={onDismissLoad}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className={catalogStyles.errorBanner} role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className={catalogStyles.errorBannerDismiss}
            onClick={onDismissAction}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
