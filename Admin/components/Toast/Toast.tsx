'use client';

import { useEffect } from 'react';
import styles from './Toast.module.css';

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export function Toast({ open, message, onClose, durationMs = 2800 }: Props) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      onClose();
    }, durationMs);
    return () => window.clearTimeout(t);
    // Intentionally only re-arm when open/message/duration change
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose may be inline
  }, [open, message, durationMs]);

  if (!open) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
