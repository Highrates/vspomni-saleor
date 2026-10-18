/** FAQ answer: strip HTML on write (store markdown-lite only). */
import DOMPurify = require('isomorphic-dompurify');

export function sanitizeFaqTextForWrite(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
}
