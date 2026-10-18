import styles from './PrimaryBtn.module.css';

export type PrimaryBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode;
};

/** Primary CTA как CartDrawer «Оформить заказ»: full-width, pill, uppercase. */
export function PrimaryBtn({
  type = 'button',
  className,
  children,
  ...rest
}: PrimaryBtnProps) {
  return (
    <button
      type={type}
      className={[styles.btn, className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
