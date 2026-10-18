import DOMPurify from 'isomorphic-dompurify';

const SANITIZE = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSafeHref(href: string): boolean {
  const t = href.trim();
  if (!t) return false;
  if (t.startsWith('/') && !t.startsWith('//')) return true;
  if (t.startsWith('#')) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function inlineMarkdown(escaped: string): string {
  return escaped.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, hrefRaw: string) => {
      const href = hrefRaw.trim();
      if (!isSafeHref(href)) return label;
      const safe = escapeHtml(href);
      const external = /^https?:/i.test(href);
      const rel = external ? ' rel="noopener noreferrer"' : '';
      const target = external ? ' target="_blank"' : '';
      return `<a href="${safe}"${target}${rel}>${label}</a>`;
    },
  );
}

/** Markdown-lite → HTML: абзацы, списки `-`/`*`, ссылки `[текст](url)`. */
export function faqAnswerToHtml(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = inlineMarkdown(escapeHtml(para.join('\n')));
    blocks.push(`<p>${text.replace(/\n/g, '<br>')}</p>`);
    para = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      `<ul>${list.map((li) => `<li>${inlineMarkdown(escapeHtml(li))}</li>`).join('')}</ul>`,
    );
    list = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]!);
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    flushList();
    para.push(line);
  }
  flushList();
  flushPara();

  return DOMPurify.sanitize(blocks.join(''), SANITIZE);
}

/** Плоский текст ответа для JSON-LD / aria. */
export function faqAnswerPlainText(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
