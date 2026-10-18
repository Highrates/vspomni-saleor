/** `export =` из пакета; default import без esModuleInterop даёт undefined в Nest (CJS). */
import DOMPurify = require('isomorphic-dompurify');

let anchorsRelHookRegistered = false;

function ensureAnchorRelNoopenerHook(): void {
  if (anchorsRelHookRegistered) return;
  anchorsRelHookRegistered = true;
  try {
    DOMPurify.addHook(
      'afterSanitizeAttributes',
      (node: Element & { setAttribute?: (n: string, v: string) => void }) => {
        const name = node.nodeName?.toUpperCase?.() ?? '';
        if (name !== 'A') return;
        const tgt = node.getAttribute?.('target');
        if (tgt !== '_blank') return;
        const existing = (node.getAttribute?.('rel') ?? '').trim().split(/\s+/).filter(Boolean);
        const need = ['noopener', 'noreferrer'];
        const merged = [...new Set([...existing, ...need])].join(' ');
        node.setAttribute?.('rel', merged);
      },
    );
  } catch {
    /* без хука санитайз всё равно режет XSS */
  }
}

/** Allowlist под Quill rich-поля товара (витрина). */
const SANITIZE = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'h1',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'blockquote',
    'div',
    'span',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'width',
    'height',
    'target',
    'rel',
    'loading',
  ],
  ALLOW_DATA_ATTR: false,
};

/**
 * Санитизация Quill HTML перед записью в БД / отдачей на витрину.
 * Без script/iframe/on* и прочего XSS-вектора.
 */
export function sanitizeProductRichHtml(html: string): string {
  ensureAnchorRelNoopenerHook();
  return DOMPurify.sanitize(html ?? '', SANITIZE);
}

/** trim → sanitize → null если пусто. */
export function sanitizeRichHtmlOrNull(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = sanitizeProductRichHtml(raw).trim();
  return cleaned || null;
}
