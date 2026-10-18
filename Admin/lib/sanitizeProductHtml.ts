import DOMPurify from 'isomorphic-dompurify';

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

/** Defense-in-depth: санитайз Quill HTML на чтении (витрина). */
export function sanitizeProductHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';
  return DOMPurify.sanitize(html, SANITIZE);
}
