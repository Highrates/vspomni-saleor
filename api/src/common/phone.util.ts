/**
 * Нормализация и проверка телефона (RU + E.164-подобные).
 * Дублирует FE `lib/phone.ts` — без общего пакета в monorepo.
 */

export function normalizePhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) {
    d = `7${d.slice(1)}`;
  }
  return d;
}

export function isValidPhone(raw: string): boolean {
  const d = normalizePhoneDigits(raw);
  if (d.length < 10 || d.length > 15) return false;
  if (d.length === 11 && d.startsWith('7')) return true;
  if (d.length === 10) return true;
  return d.length >= 10 && d.length <= 15;
}

export function formatPhoneE164(raw: string): string {
  const d = normalizePhoneDigits(raw);
  if (!d) return '';
  if (d.startsWith('7') && d.length === 11) return `+${d}`;
  if (d.length >= 10) return `+${d}`;
  return d;
}
