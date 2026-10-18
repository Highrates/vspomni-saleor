/** Сниппеты ссылок на товар для блоков результата квиза (парсятся на витрине). */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildQuizProductHtmlSnippet(name: string, slug: string): string {
  const safeName = escapeHtml(name.trim());
  const safeSlug = slug.trim();
  return `<p><strong>Средство:</strong> <a href="/product/${safeSlug}">${safeName}</a></p>`;
}

export function buildQuizProductPlainSnippet(name: string, slug: string): string {
  return `*Средство*: [${name.trim()}](/product/${slug.trim()})`;
}

export function appendQuizProductsToEntry(
  item: { plain: string; html: string },
  products: Array<{ name: string; slug: string }>,
): { plain: string; html: string } {
  if (products.length === 0) return item;

  let plain = item.plain.trim();
  let html = item.html.trim();

  for (const p of products) {
    const plainLine = buildQuizProductPlainSnippet(p.name, p.slug);
    const htmlBlock = buildQuizProductHtmlSnippet(p.name, p.slug);
    plain = plain ? `${plain}\n\n${plainLine}` : plainLine;
    html = html ? `${html}\n${htmlBlock}` : htmlBlock;
  }

  return { plain, html };
}

export function isQuizResultBlockEmpty(item: { plain: string; html: string }): boolean {
  return !item.plain.trim() && !item.html.trim();
}
