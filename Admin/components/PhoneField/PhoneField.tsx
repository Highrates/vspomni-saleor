'use client';

import { FloatingTextField } from '@/components/FloatingTextField/FloatingTextField';
import {
  formatPhoneInputValue,
  ruPhoneDigits,
} from '@/lib/phone';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
};

/**
 * Телефон с маской +7 (999) 123-45-67 (можно начать с 8 или 9XX).
 */
export function PhoneField({
  label = 'Телефон',
  value,
  onChange,
  error,
  disabled,
  required,
  className,
  id,
  name,
}: Props) {
  const display = formatPhoneInputValue(value);

  return (
    <FloatingTextField
      id={id}
      name={name}
      label={label}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={display}
      required={required}
      disabled={disabled}
      error={error}
      className={className}
      onChange={(e) => onChange(formatPhoneInputValue(e.target.value))}
      onKeyDown={(e) => {
        if (e.key !== 'Backspace') return;
        const digits = ruPhoneDigits(display);
        if (digits.length <= 1) {
          e.preventDefault();
          onChange('');
        }
      }}
      onBlur={() => {
        if (value.trim()) {
          const next = formatPhoneInputValue(value);
          if (next !== value) onChange(next);
        }
      }}
    />
  );
}
