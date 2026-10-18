'use client';

import type { ReactNode } from 'react';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import styles from './AdminSettingsListSticky.module.css';

/**
 * Sticky Save for settings-list editors nested under a page title/tabs.
 * Does not use productNew full-bleed stickyToolbar (negative margins break hubs).
 */
export function AdminSettingsListSticky({
  title,
  dirty,
  saving,
  canSave,
  storefrontHref,
  storefrontLabel = 'Открыть на сайте ↗',
  leading,
}: {
  title?: string;
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  storefrontHref?: string | null;
  storefrontLabel?: string;
  leading?: ReactNode;
}) {
  const hasMeta = Boolean(storefrontHref) || dirty;

  return (
    <div className={styles.bar}>
      <div className={styles.main}>
        {leading}
        {title ? <h2 className={styles.title}>{title}</h2> : null}
        {hasMeta ? (
          <div className={styles.meta}>
            {storefrontHref ? (
              <a
                className={styles.storefrontLink}
                href={storefrontHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {storefrontLabel}
              </a>
            ) : null}
            {dirty ? <span className={styles.dirtyHint}>Несохранённые изменения</span> : null}
          </div>
        ) : null}
      </div>
      <div className={styles.actions}>
        <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </AdminCompactBtn>
      </div>
    </div>
  );
}
