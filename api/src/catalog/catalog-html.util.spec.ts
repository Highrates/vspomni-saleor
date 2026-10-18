import { describe, expect, it } from 'vitest';
import { sanitizeProductRichHtml, sanitizeRichHtmlOrNull } from './catalog-html.util';

describe('sanitizeProductRichHtml', () => {
  it('убирает script и on*-атрибуты', () => {
    const out = sanitizeProductRichHtml(
      '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain('<p>ok</p>');
  });

  it('оставляет безопасные теги Quill', () => {
    const out = sanitizeProductRichHtml('<p><strong>A</strong> <em>B</em></p><ul><li>1</li></ul>');
    expect(out).toContain('<strong>');
    expect(out).toContain('<em>');
    expect(out).toContain('<li>');
  });

  it('sanitizeRichHtmlOrNull → null на пустом', () => {
    expect(sanitizeRichHtmlOrNull('   ')).toBeNull();
    expect(sanitizeRichHtmlOrNull(null)).toBeNull();
    expect(sanitizeRichHtmlOrNull('<p>x</p>')).toContain('x');
  });
});
