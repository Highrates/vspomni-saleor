import styles from '@/components/admin/AdminCheckbox/AdminCheckbox.module.css';

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

/** Чекбокс витрины / ЛК (общий стиль с AdminCheckbox). */
export function Checkbox({ className, ...rest }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`${styles.checkbox} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
