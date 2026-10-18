'use client';

import { useId, useState } from 'react';
import styles from './AdminAccordion.module.css';

export function AdminAccordion({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.title}>{title}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
