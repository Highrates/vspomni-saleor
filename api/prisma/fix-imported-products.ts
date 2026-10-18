/**
 * Нормализация уже импортированных товаров:
 * - убрать « — оттенок» из названия
 * - оттенки с большой буквы
 * - имя варианта = «N мл» или название продукта
 * - volumeMl по умолчанию 30, если нет
 * - shortDescription из описания
 *
 *   npx ts-node --transpile-only prisma/fix-imported-products.ts
 */
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/catalog/slug.util';

const prisma = new PrismaClient();
const DEFAULT_VOLUME_ML = 30;

function capitalizeName(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase('ru-RU') + t.slice(1);
}

/** Убираем суффикс « — оттенки» из названия. */
function stripShadeSuffix(name: string): string {
  return name.replace(/\s*[—–−-]\s+.+$/u, '').trim();
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeShortDescription(
  productName: string,
  descriptionHtml: string | null,
  categoryName: string | null,
): string {
  const plain = stripHtml(descriptionHtml);
  if (plain) {
    const sentence = plain.split(/(?<=[.!?…])\s+/)[0] || plain;
    const clipped = sentence.length > 140 ? `${sentence.slice(0, 137).trim()}…` : sentence;
    if (clipped.length >= 24) return clipped;
  }
  if (categoryName) return `${productName} — ${categoryName.toLowerCase()} Jcos`;
  return `${productName} — декоративная косметика Jcos`;
}

function variantDisplayName(volumeMl: number | null, productName: string): string {
  if (volumeMl != null && volumeMl > 0) return `${volumeMl} мл`;
  return productName;
}

async function uniqueVariantSlug(productId: string, base: string, excludeId?: string) {
  let slug = (base || 'variant').slice(0, 80);
  let n = 2;
  for (;;) {
    const found = await prisma.productVariant.findFirst({
      where: { productId, slug },
    });
    if (!found || found.id === excludeId) return slug;
    slug = `${base.slice(0, 70)}-${n++}`;
  }
}

async function main() {
  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      variants: { include: { shades: true } },
    },
  });

  let n = 0;
  for (const p of products) {
    const cleanName = stripShadeSuffix(p.name);
    const shortDescription = makeShortDescription(
      cleanName,
      p.descriptionHtml,
      p.category?.name ?? null,
    );

    await prisma.product.update({
      where: { id: p.id },
      data: {
        name: cleanName,
        shortDescription,
      },
    });

    for (const v of p.variants) {
      const volumeMl = v.volumeMl != null && v.volumeMl > 0 ? v.volumeMl : DEFAULT_VOLUME_ML;
      const vName = capitalizeName(variantDisplayName(volumeMl, cleanName));
      const vSlug = await uniqueVariantSlug(v.productId, slugify(vName), v.id);

      await prisma.productVariant.update({
        where: { id: v.id },
        data: {
          name: vName,
          slug: vSlug,
          volumeMl,
          nationalCatalogName: v.nationalCatalogName
            ? stripShadeSuffix(v.nationalCatalogName)
            : cleanName,
        },
      });

      for (const s of v.shades) {
        const shadeName = capitalizeName(s.name);
        if (shadeName !== s.name) {
          await prisma.productVariantShade.update({
            where: { id: s.id },
            data: { name: shadeName },
          });
        }
      }
    }
    n++;
    console.log(`[fix] ${cleanName}`);
  }
  console.log(`[fix] done: ${n} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
