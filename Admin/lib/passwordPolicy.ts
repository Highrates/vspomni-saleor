/** Общие правила пароля покупателя (FE + BE должны совпадать). */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordIssue =
  | 'empty'
  | 'short'
  | 'no_letter'
  | 'no_digit';

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

const LETTER_RE = /[A-Za-zА-Яа-яЁё]/;
const DIGIT_RE = /\d/;
const SPECIAL_RE = /[^A-Za-zА-Яа-яЁё0-9\s]/;

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

export function passwordIssueMessage(issue: PasswordIssue): string {
  switch (issue) {
    case 'empty':
      return 'Введите пароль';
    case 'short':
      return `Пароль не короче ${PASSWORD_MIN_LENGTH} символов`;
    case 'no_letter':
      return 'Добавьте хотя бы одну букву';
    case 'no_digit':
      return 'Добавьте хотя бы одну цифру';
  }
}

/** Первая ошибка для формы. */
export function firstPasswordError(password: string): string | null {
  const issues = passwordIssues(password);
  if (!issues.length) return null;
  return passwordIssueMessage(issues[0]!);
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (LETTER_RE.test(password) && DIGIT_RE.test(password)) score += 1;
  if (/[A-ZА-ЯЁ]/.test(password) && /[a-zа-яё]/.test(password)) score += 1;
  if (SPECIAL_RE.test(password)) score += 1;
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}

export function passwordStrengthLabel(s: PasswordStrength): string {
  switch (s) {
    case 'weak':
      return 'Слабый';
    case 'fair':
      return 'Средний';
    case 'good':
      return 'Хороший';
    case 'strong':
      return 'Надёжный';
  }
}
