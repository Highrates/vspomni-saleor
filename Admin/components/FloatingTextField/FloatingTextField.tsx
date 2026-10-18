'use client';

import { useId, useState } from 'react';
import styles from './FloatingTextField.module.css';

export type FloatingTextFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'placeholder'
> & {
  label: string;
  error?: boolean | string;
  /** Обёртка */
  className?: string;
};

function PasswordToggleButton({
  visible,
  onToggle,
  inputId,
}: {
  visible: boolean;
  onToggle: () => void;
  inputId: string;
}) {
  return (
    <button
      type="button"
      className={styles.passwordToggle}
      aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      aria-controls={inputId}
      aria-pressed={visible}
      onClick={onToggle}
      tabIndex={-1}
    >
      {visible ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 3l18 18M10.58 10.58A2 2 0 0012 15a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7.5a11.62 11.62 0 01-4.12 4.97M6.12 6.12A11.35 11.35 0 002 12.5C3.73 16.39 8 19.5 13 19.5c1.55 0 3.03-.3 4.38-.85"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="13" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  );
}

/**
 * Инпут с «плавающим» заголовком: линия + label внутри;
 * при фокусе / значении label уезжает вверх.
 * type=password — show/hide + Caps Lock hint.
 */
export function FloatingTextField({
  label,
  error,
  className,
  id,
  value,
  defaultValue,
  disabled,
  type,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
  onKeyUp,
  ...inputProps
}: FloatingTextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorSuffix = useId();
  const capsId = useId();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(
    defaultValue != null ? String(defaultValue) : '',
  );

  const isControlled = value !== undefined;
  const current = isControlled ? String(value ?? '') : uncontrolled;
  const filled = current.length > 0;
  const active = focused || filled;
  const invalid =
    error === true || (typeof error === 'string' && error.trim().length > 0);
  const isPassword = type === 'password';
  const resolvedType = isPassword && passwordVisible ? 'text' : type;
  const errorId =
    typeof error === 'string' && error.trim() ? `err-${errorSuffix}` : undefined;
  const showCaps = isPassword && focused && capsOn;
  const describedBy = [errorId, showCaps ? capsId : null].filter(Boolean).join(' ') || undefined;

  function syncCaps(e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) {
    if (!isPassword) return;
    const native = e.nativeEvent as KeyboardEvent;
    if (typeof native.getModifierState === 'function') {
      setCapsOn(native.getModifierState('CapsLock'));
    }
  }

  return (
    <div
      className={[
        styles.field,
        active ? styles.fieldActive : '',
        focused ? styles.fieldFocused : '',
        filled ? styles.fieldFilled : '',
        invalid ? styles.fieldInvalid : '',
        disabled ? styles.fieldDisabled : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          {...inputProps}
          id={inputId}
          type={resolvedType}
          className={[styles.input, isPassword ? styles.inputWithToggle : '']
            .filter(Boolean)
            .join(' ')}
          disabled={disabled}
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => {
            setFocused(true);
            syncCaps(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setCapsOn(false);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            syncCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            syncCaps(e);
            onKeyUp?.(e);
          }}
          onChange={(e) => {
            if (!isControlled) setUncontrolled(e.target.value);
            onChange?.(e);
          }}
        />
        {isPassword && !disabled ? (
          <PasswordToggleButton
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
            inputId={inputId}
          />
        ) : null}
      </div>
      {showCaps ? (
        <p id={capsId} className={styles.capsHint} role="status">
          Включён Caps Lock
        </p>
      ) : null}
      {typeof error === 'string' && error.trim() ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
