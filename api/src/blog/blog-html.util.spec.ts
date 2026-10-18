import { describe, expect, it } from 'vitest';
import {
  extractMediaUrlsFromRichHtml,
  sanitizeBlogBodyForWrite,
  sanitizeBlogExcerptHtml,
  sanitizeBlogPostBodyHtml,
} from './blog-html.util';
import { slugify } from '../catalog/slug.util';

describe('sanitizeBlogPostBodyHtml', () => {
  it('убирает script и on*', () => {
    const out = sanitizeBlogPostBodyHtml(
      '<p>ok</p><script>alert(1)</script><img src="/uploads/a.jpg" onerror="x">',
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain('<p>ok</p>');
  });

  it('sanitize на write совпадает с read', () => {
    const dirty = '<p>Hi</p><script>x</script>';
    expect(sanitizeBlogBodyForWrite(dirty)).toBe(sanitizeBlogPostBodyHtml(dirty));
  });
});

describe('sanitizeBlogExcerptHtml', () => {
  it('null на пустом', () => {
    expect(sanitizeBlogExcerptHtml('')).toBeNull();
    expect(sanitizeBlogExcerptHtml('   ')).toBeNull();
    expect(sanitizeBlogExcerptHtml(null)).toBeNull();
  });

  it('режет img/script', () => {
    const out = sanitizeBlogExcerptHtml('<p>lead</p><img src="x"><script>1</script>');
    expect(out).toContain('lead');
    expect(out).not.toMatch(/img|script/i);
  });
});

describe('extractMediaUrlsFromRichHtml', () => {
  it('достаёт src', () => {
    expect(
      extractMediaUrlsFromRichHtml('<p><img src="https://x/a.jpg"></p><video src="/v.mp4">'),
    ).toEqual(['https://x/a.jpg', '/v.mp4']);
  });
});

describe('blog slug uniqueness helpers', () => {
  it('slugify для title → base slug', () => {
    expect(slugify('Новости Jcos')).toBe('novosti-jcos');
  });
});
