import type { MetadataRoute } from 'next'
import { fetchAllProductCards, fetchCategories, type NestCategory } from '@/api/catalogApi'
import { absoluteUrl, getPublicSiteUrl } from '@/lib/siteUrl'
import { getAllCategory } from '@/graphql/queries/category.service'
import { getAllArticles } from '@/graphql/queries/articles.service'
import { getAllAromas } from '@/graphql/queries/allAromas.service'
import { isValidSlug } from '@/lib/productPaths'

const MAX_URLS = 49_000

/** Реальная дата из БД; без даты — не подставляем «сейчас» (ломает краулеров). */
function toLastMod(d?: string | null): Date | undefined {
  if (!d) return undefined
  const t = Date.parse(d)
  return Number.isFinite(t) ? new Date(t) : undefined
}

function productLocPath(
  productSlug: string,
  categorySlug?: string | null,
): string {
  const cat = categorySlug?.trim()
  if (cat) {
    return `/category/${encodeURIComponent(cat)}/${encodeURIComponent(productSlug)}`
  }
  return `/product/${encodeURIComponent(productSlug)}`
}

function flattenCategories(items: NestCategory[]): NestCategory[] {
  return items.flatMap((c) => [c, ...flattenCategories(c.children ?? [])])
}

async function fetchAllPublishedProductsForSitemap(): Promise<
  { slug: string; categorySlug: string | null; updatedAt: string | null }[]
> {
  // Nest-карточки не содержат категорию → строим slug→category через выдачу по категориям
  const categoryBySlug = new Map<string, string>()
  try {
    const { items } = await fetchCategories()
    for (const cat of flattenCategories(items)) {
      const cards = await fetchAllProductCards({ category: cat.slug }, MAX_URLS)
      for (const c of cards) {
        if (!categoryBySlug.has(c.slug)) categoryBySlug.set(c.slug, cat.slug)
      }
    }
  } catch {
    /* sitemap без категорий в путях */
  }

  const all = await fetchAllProductCards({}, MAX_URLS)
  return all.map((c) => ({
    slug: c.slug,
    categorySlug: categoryBySlug.get(c.slug) ?? null,
    updatedAt: null,
  }))
}

/** Данные для /sitemap.xml (динамически, до лимита URL) */
export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicSiteUrl()
  const entries: MetadataRoute.Sitemap = []
  const seen = new Set<string>()

  const push = (path: string, lastModified?: Date) => {
    if (entries.length >= MAX_URLS) return
    if (seen.has(path)) return
    seen.add(path)
    const entry: MetadataRoute.Sitemap[number] = {
      url: absoluteUrl(path),
    }
    if (lastModified) entry.lastModified = lastModified
    entries.push(entry)
  }

  // Статика без lastmod — нет надёжной даты в БД
  push('/')
  push('/catalog')
  push('/news')
  push('/partners')
  push('/korporativnye-podarki')

  try {
    const categories = await getAllCategory(100)
    for (const c of categories) {
      if (!c.slug) continue
      push(`/category/${encodeURIComponent(c.slug)}`)
    }
  } catch {
    /* ignore */
  }

  try {
    const products = await fetchAllPublishedProductsForSitemap()
    for (const p of products) {
      if (entries.length >= MAX_URLS) break
      if (!isValidSlug(p.slug)) continue
      push(productLocPath(p.slug, p.categorySlug), toLastMod(p.updatedAt))
    }
  } catch {
    /* ignore */
  }

  try {
    const articles = await getAllArticles(500)
    for (const a of articles) {
      if (!a.slug) continue
      if (entries.length >= MAX_URLS) break
      const mod = a.publishedAt || a.created
      push(`/article/${encodeURIComponent(a.slug)}`, toLastMod(mod))
    }
  } catch {
    /* ignore */
  }

  try {
    const aromas = await getAllAromas()
    for (const ar of aromas) {
      if (!ar.slug) continue
      if (entries.length >= MAX_URLS) break
      if (!ar.title?.trim() && !ar.text?.trim()) continue
      push(
        `/catalog/aroma/${encodeURIComponent(ar.slug)}`,
        toLastMod(ar.publishedAt),
      )
    }
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV === 'development') {
    console.info(`[sitemap] ${entries.length} URLs, base=${base}`)
  }

  return entries
}
