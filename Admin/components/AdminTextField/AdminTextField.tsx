'use client';

import { useId } from 'react';
import styles from './AdminTextField.module.css';

type AdminFieldError = boolean | string | undefined;

type AdminFieldShellProps = {
  label?: string;
  error?: AdminFieldError;
  disabled?: boolean;
  className?: string;
  id?: string;
  children: (ids: { inputId: string; errorId?: string; invalid: boolean }) => React.ReactNode;
};

function controlClass(kind: 'input' | 'textarea' | 'select', extra?: string) {
  return `${styles.control} ${styles[kind]} ${extra ?? ''}`.trim();
}

function useAdminFieldIds(id: string | undefined, error: AdminFieldError) {
  const generatedId = useId();
  const errorSuffix = useId();
  const inputId = id ?? generatedId;
  const errorId = typeof error === 'string' && error.trim() ? `err-${errorSuffix}` : undefined;
  const invalid = Boolean(error === true || (typeof error === 'string' && error.trim().length > 0));
  return { inputId, errorId, invalid };
}

function AdminFieldShell({
  label,
  error,
  disabled,
  className,
  id,
  children,
}: AdminFieldShellProps) {
  const { inputId, errorId, invalid } = useAdminFieldIds(id, error);

  return (
    <div
      className={`${styles.field} ${disabled ? styles.fieldDisabled : ''} ${className ?? ''}`.trim()}
    >
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      {children({ inputId, errorId, invalid })}
      {typeof error === 'string' && error.trim() ? (
        <p id={errorId} className={styles.errorMessage} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type AdminTextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: AdminFieldError;
  /** Обёртка поля (label + input + error). */
  className?: string;
  /** Доп. класс на `<input>`. */
  controlClassName?: string;
};

/** Компактное текстовое поле админки: h-28, hairline, прозрачный фон. */
export function AdminTextField({
  label,
  error,
  disabled,
  readOnly,
  className,
  controlClassName,
  id,
  ...inputProps
}: AdminTextFieldProps) {
  return (
    <AdminFieldShell label={label} error={error} disabled={disabled} className={className} id={id}>
      {({ inputId, errorId, invalid }) => (
        <input
          id={inputId}
          className={controlClass('input', controlClassName)}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={errorId}
          {...inputProps}
        />
      )}
    </AdminFieldShell>
  );
}

export type AdminTextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: AdminFieldError;
  className?: string;
  controlClassName?: string;
};

/** Многострочное поле в стиле AdminTextField. */
export type AdminSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: AdminFieldError;
  className?: string;
  controlClassName?: string;
  children: React.ReactNode;
};

/** Select в стиле AdminTextField. */
export function AdminSelect({
  label,
  error,
  disabled,
  className,
  controlClassName,
  id,
  children,
  ...selectProps
}: AdminSelectProps) {
  return (
    <AdminFieldShell label={label} error={error} disabled={disabled} className={className} id={id}>
      {({ inputId, errorId, invalid }) => (
        <select
          id={inputId}
          className={controlClass('select', controlClassName)}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={errorId}
          {...selectProps}
        >
          {children}
        </select>
      )}
    </AdminFieldShell>
  );
}

export function AdminTextArea({
  label,
  error,
  disabled,
  readOnly,
  className,
  controlClassName,
  id,
  ...textareaProps
}: AdminTextAreaProps) {
  return (
    <AdminFieldShell label={label} error={error} disabled={disabled} className={className} id={id}>
      {({ inputId, errorId, invalid }) => (
        <textarea
          id={inputId}
          className={controlClass('textarea', controlClassName)}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={errorId}
          {...textareaProps}
        />
      )}
    </AdminFieldShell>
  );
}
