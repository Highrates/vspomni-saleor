'use client';

import styles from './AdminCheckbox.module.css';

export type AdminCheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Админский чекбокс (стиль Win-Win AccountCheckbox). */
export function AdminCheckbox({ className, ...rest }: AdminCheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`${styles.checkbox} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
