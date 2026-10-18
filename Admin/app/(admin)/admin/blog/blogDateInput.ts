function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Значение для `<input type="date">` в локальной зоне (YYYY-MM-DD). */
export function dateToDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoOrNowToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return dateToDateInputValue(new Date());
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dateToDateInputValue(new Date());
  return dateToDateInputValue(d);
}

/** ISO8601 для API из значения date (полночь по локальному календарю). */
export function dateInputToIso(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date().toISOString();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  return new Date(y, mo - 1, da, 0, 0, 0, 0).toISOString();
}
