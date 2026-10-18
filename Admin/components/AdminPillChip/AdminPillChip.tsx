import styles from './AdminPillChip.module.css';

export type AdminPillChipVariant = 'default' | 'conflict';

export type AdminPillChipProps = {
  children: React.ReactNode;
  onRemove?: () => void;
  removeAriaLabel?: string;
  variant?: AdminPillChipVariant;
  className?: string;
};

export type AdminPillChipListProps = {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
};

/** Список pill-чипов в стиле AdminTabs (variant pill, active). */
export function AdminPillChipList({ children, className, 'aria-label': ariaLabel }: AdminPillChipListProps) {
  return (
    <ul className={`${styles.list} ${className ?? ''}`.trim()} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

/** Статичный pill-бейдж (без удаления), например «Основной» в списке профилей. */
export function AdminPillBadge({
  children,
  variant = 'default',
  className,
  ...rest
}: Pick<AdminPillChipProps, 'children' | 'variant' | 'className'> &
  Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'className'>) {
  return (
    <span
      className={`${styles.chip} ${styles.badgeInline} ${variant === 'conflict' ? styles.chipConflict : ''} ${className ?? ''}`.trim()}
      {...rest}
    >
      <span className={styles.label}>{children}</span>
    </span>
  );
}

/** Removable pill-чип админки: как активная вкладка AdminTabs pill. */
export function AdminPillChip({
  children,
  onRemove,
  removeAriaLabel,
  variant = 'default',
  className,
}: AdminPillChipProps) {
  return (
    <li
      className={`${styles.chip} ${variant === 'conflict' ? styles.chipConflict : ''} ${className ?? ''}`.trim()}
    >
      <span className={styles.label}>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={removeAriaLabel}
        >
          <span className={styles.removeIcon} aria-hidden>
            ×
          </span>
        </button>
      ) : null}
    </li>
  );
}
