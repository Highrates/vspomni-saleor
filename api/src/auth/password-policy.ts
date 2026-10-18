/** Общие правила пароля покупателя (синхронно с frontend/lib/passwordPolicy.ts). */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordIssue = 'empty' | 'short' | 'no_letter' | 'no_digit';

const LETTER_RE = /[A-Za-zА-Яа-яЁё]/;
const DIGIT_RE = /\d/;

export function passwordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length === 0) {
    issues.push('empty');
    return issues;
  }
  if (password.length < PASSWORD_MIN_LENGTH) issues.push('short');
  if (!LETTER_RE.test(password)) issues.push('no_letter');
  if (!DIGIT_RE.test(password)) issues.push('no_digit');
  return issues;
}

export function isPasswordValid(password: string): boolean {
  return passwordIssues(password).length === 0;
}

export function firstPasswordError(password: string): string | null {
  const issues = passwordIssues(password);
  if (!issues.length) return null;
  switch (issues[0]) {
    case 'empty':
      return 'Введите пароль';
    case 'short':
      return `Пароль не короче ${PASSWORD_MIN_LENGTH} символов`;
    case 'no_letter':
      return 'Добавьте хотя бы одну букву';
    case 'no_digit':
      return 'Добавьте хотя бы одну цифру';
    default:
      return 'Некорректный пароль';
  }
}
