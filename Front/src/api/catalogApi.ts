/**
 * Каталог Nest `/api/v1/catalog/*` + адаптеры под типы Vspomni Front
 * (`ProductCardItem`, `StarChoiceItem`, `ProductDetailNode`).
 */
import {
  CHOICE_COLLECTION_SLUG as SHARED_CHOICE_COLLECTION_SLUG,
  NEW_COLLECTION_SLUG as SHARED_NEW_COLLECTION_SLUG,
  POPULAR_COLLECTION_SLUG as SHARED_POPULAR_COLLECTION_SLUG,
  formatChoiceStarDate,
} from '@vspomni/catalog-constants'
import { ApiError, apiFetch, apiJson, uploadsUrl } from '@/api/apiClient'
import type { ProductDetailNode } from '@/graphql/types/product.types'
import type { ProductCardItem, StarChoiceItem } from '@/types/product'
import { htmlToRawEditorJsonString } from '@/lib/nestContent'
import { buildProductNotes } from '@/lib/product/aromaNotes'

// ——— Nest raw types ———

export type NestProductCard = {
  id: string
  variantId: string | null
  variantName: string | null
  shadeId: string | null
  shadeName: string | null
  slug: string
  name: string
  shortDescription: string | null
  productType?: string | null
  price: number
  oldPrice: number | null
  discountPercent: number | null
  priceFrom: boolean
  available: number
  minQty: number
  maxQty: number
  imageUrl: string | null
  imageUrls: string[]
  mediaType: 'image' | 'video'
  /** Присутствует не во всех выдачах */
  category?: { id?: string; name?: string; slug?: string } | null
  categorySlug?: string | null
  choiceStarName?: string | null
  choiceStarDate?: string | null
  choiceStarImageUrl?: string | null
  /** Ароматы со смайликами для ProductCard (и PDP) */
  cardAromaLabels?: string[]
  /** Лейбл на карточке (например NEW); null = без бейджа */
  badgeLabel?: string | null
}

type NestVariantImage = {
  id: string
  url: string
  mediaType: 'image' | 'video'
  sortOrder: number
}

type NestVariant = {
  id: string
  name: string
  slug: string
  volumeMl: number | null
  weightGrams?: number | null
  lengthMm?: number | null
  widthMm?: number | null
  heightMm?: number | null
  sku: string | null
  price: number
  compareAt: number | null
  orderMinQty: number
  orderMaxQty: number | null
  stock: number
  stockReserve: number
  available: number
  images: NestVariantImage[]
}

type NestCategoryRef = {
  id: string
  name: string
  slug: string
  parent?: {
    id: string
    name: string
    slug: string
    parent?: { id: string; name: string; slug: string } | null
  } | null
}

export type NestProductDetail = {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  descriptionHtml: string | null
  pageShortDescriptionHtml: string | null
  actionEffectHtml: string | null
  applicationHtml: string | null
  compositionHtml: string | null
  importantNoteHtml: string | null
  /** Vspomni: поле Nest `vspomniNoteHtml` (в БД колонка `mirafloresNoteHtml`) */
  vspomniNoteHtml?: string | null
  /** Legacy-имя поля (на случай старого ответа API) */
  mirafloresNoteHtml?: string | null
  storageHtml: string | null
  productType: string | null
  purpose: string | null
  shelfLife: string | null
  extraHtml: string | null
  category: NestCategoryRef | null
  catalogTags?: Array<{ id: string; name: string; slug: string; sortOrder: number }>
  cardAromaLabels?: string[]
  badgeLabel?: string | null
  /** Пирамида нот: BASIC / MIDDLE / HEAD */
  aromaNotes?: Array<{
    id: string
    kind: 'BASIC' | 'MIDDLE' | 'HEAD' | string
    name: string
    imageUrl: string | null
    sortOrder: number
  }>
  images: NestVariantImage[]
  variants: NestVariant[]
  minPrice: number | null
  maxPrice: number | null
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  canonicalPath: string | null
  seoNoIndex: boolean
}

export type NestCategory = {
  id: string
  name: string
  slug: string
  parentId: string | null
  imageUrl: string | null
  description?: string | null
  children?: NestCategory[]
}

export type NestCollection = {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  coverImageUrl: string | null
  featuredLayout?: boolean
  productPreviewUrl?: string | null
  products?: NestProductCard[]
}

export type CatalogCollectionPublic = NestCollection

export type CatalogTagPublic = {
  id: string
  name: string
  slug: string
  coverImageUrl: string | null
  sortOrder?: number
  /** Заголовок из доп. инфо (CatalogTagStep) */
  title?: string | null
  /** Описание из доп. инфо */
  description?: string | null
}

export type CartSyncLine = { variantId: string; qty: number }

export type CartSyncResponse = {
  items: Array<{
    key: string
    productId: string
    variantId: string
    shadeId: string | null
    shadeName: string | null
    slug: string
    name: string
    productType?: string | null
    variantName: string
    imageUrl: string | null
    price: number
    listPrice: number
    minQty: number
    maxQty: number
    qty: number
    isGiftDenom?: boolean
    /** Nest ProductVariant — для BFF-расчёта доставки */
    weightGrams?: number | null
    lengthMm?: number | null
    widthMm?: number | null
    heightMm?: number | null
  }>
  removedKeys: string[]
  removedLines?: Array<{ key: string; reason: 'oos' | 'missing'; name?: string }>
  listSubtotal: number
  subtotal: number
  campaignDiscountTotal: number
}

// ——— Слаги коллекций витрины ———

/** Коллекция «Выбор ⭐» */
export const CHOICE_COLLECTION_SLUG = SHARED_CHOICE_COLLECTION_SLUG
/** Популярное (диффузоры) */
export const POPULAR_COLLECTION_SLUG = SHARED_POPULAR_COLLECTION_SLUG
/** Кое-что новое для вас */
export const NEW_COLLECTION_SLUG = SHARED_NEW_COLLECTION_SLUG

// ——— Caches ———

let collectionsCache: { items: NestCollection[] } | null = null
let collectionsInflight: Promise<{ items: NestCollection[] }> | null = null
let categoriesCache: { items: NestCategory[] } | null = null
let categoriesInflight: Promise<{ items: NestCategory[] }> | null = null
let catalogTagsCache: { items: CatalogTagPublic[] } | null = null
let catalogTagsInflight: Promise<{ items: CatalogTagPublic[] }> | null = null

/** Server components живут дольше запроса — не держим кэш в RSC, только в браузере. */
const IS_BROWSER = typeof window !== 'undefined'

/** Invalidate tags/categories/collections memory caches. */
export function clearCatalogApiCaches() {
  catalogTagsCache = null
  catalogTagsInflight = null
  categoriesCache = null
  categoriesInflight = null
  collectionsCache = null
  collectionsInflight = null
}

// ——— Adapters ———

function absUrl(u: string | null | undefined): string {
  return uploadsUrl(u) || ''
}

/** Нормализованные ссылки медиа карточки. */
function cardImages(card: NestProductCard): { thumb: string; gallery: string[] } {
  const gallery = (card.imageUrls ?? []).map((u) => absUrl(u)).filter(Boolean)
  const thumb = absUrl(card.imageUrl) || gallery[0] || ''
  return { thumb, gallery: gallery.length ? gallery : thumb ? [thumb] : [] }
}

export function cardToProductCardItem(
  card: NestProductCard,
  opts?: { categorySlug?: string; aromas?: string[] },
): ProductCardItem {
  const { thumb, gallery } = cardImages(card)
  const variantId = card.variantId || card.id
  const oldPrice =
    card.oldPrice != null && card.oldPrice > card.price ? card.oldPrice : undefined
  const discountPercent =
    card.discountPercent != null && card.discountPercent > 0
      ? Math.round(card.discountPercent)
      : oldPrice
        ? Math.round(((oldPrice - card.price) / oldPrice) * 100)
        : undefined
  const aromas =
    opts?.aromas ??
    (card.cardAromaLabels ?? []).map((s) => String(s).trim()).filter(Boolean)
  const badgeLabel = card.badgeLabel?.trim() || null
  const categorySlug =
    (opts?.categorySlug ?? card.categorySlug ?? card.category?.slug)?.trim() || undefined

  return {
    id: variantId,
    name: card.name,
    slug: card.slug,
    categorySlug,
    thumbnail: thumb,
    image: gallery[0] || thumb,
    gallery,
    price: card.price,
    oldPrice,
    discountPercent,
    size: card.variantName || '',
    variantId,
    group: aromas.map((title, i) => ({ id: i + 1, group: 'flower', title })),
    aromas,
    badgeLabel,
    inStock: card.available > 0,
    quantityAvailable: card.available,
    quantityLimitPerCustomer: card.maxQty > 0 ? card.maxQty : null,
  }
}

/** Карточка «Выбор» (звёзды): celebrity photo + name/date from Nest choiceStar*. */
export function cardToStarChoiceItem(card: NestProductCard): StarChoiceItem {
  const { thumb, gallery } = cardImages(card)
  const starImage = uploadsUrl(card.choiceStarImageUrl) || gallery[0] || thumb
  return {
    id: card.variantId || card.id,
    name: card.name,
    size: card.variantName || '',
    thumbnail: thumb,
    image: starImage,
    price: card.price,
    oldPrice:
      card.oldPrice != null && card.oldPrice > card.price ? card.oldPrice : 0,
    star: (card.choiceStarName || '').trim(),
    date: formatChoiceStarDate(card.choiceStarDate),
    slug: card.slug,
    categorySlug: card.categorySlug?.trim() || card.category?.slug?.trim() || undefined,
  }
}

function pricingBlock(price: number, compareAt: number | null) {
  const hasDiscount = compareAt != null && compareAt > price
  return {
    price: { gross: { amount: price, currency: 'RUB' } },
    priceUndiscounted: hasDiscount
      ? { gross: { amount: compareAt as number, currency: 'RUB' } }
      : undefined,
    discount: {
      gross: { amount: hasDiscount ? (compareAt as number) - price : 0, currency: 'RUB' },
      net: { amount: hasDiscount ? (compareAt as number) - price : 0, currency: 'RUB' },
    },
  }
}

function mapVariantNode(v: NestVariant) {
  const weightKg =
    v.weightGrams != null && Number.isFinite(v.weightGrams) && v.weightGrams > 0
      ? v.weightGrams / 1000
      : undefined
  const meta: { key: string; value: string }[] = []
  if (v.lengthMm != null && v.lengthMm > 0) {
    meta.push({ key: 'dimensions.length_mm', value: String(v.lengthMm) })
  }
  if (v.widthMm != null && v.widthMm > 0) {
    meta.push({ key: 'dimensions.width_mm', value: String(v.widthMm) })
  }
  if (v.heightMm != null && v.heightMm > 0) {
    meta.push({ key: 'dimensions.height_mm', value: String(v.heightMm) })
  }
  return {
    node: {
      id: v.id,
      sku: v.sku || '',
      name: v.name,
      volumeMl: v.volumeMl ?? null,
      quantityLimitPerCustomer: v.orderMaxQty,
      quantityAvailable: v.available,
      pricing: pricingBlock(v.price, v.compareAt),
      ...(weightKg != null ? { weight: { value: weightKg } } : {}),
      ...(meta.length ? { metadata: meta } : {}),
      weightGrams: v.weightGrams ?? null,
      lengthMm: v.lengthMm ?? null,
      widthMm: v.widthMm ?? null,
      heightMm: v.heightMm ?? null,
    },
  }
}

function htmlAttr(slug: string, name: string, html: string | null | undefined) {
  const t = html?.trim()
  if (!t) return null
  return {
    attribute: { id: slug, name, slug, metadata: [] as unknown[] },
    values: [
      {
        boolean: null,
        date: null,
        dateTime: null,
        externalReference: null,
        inputType: 'RICH_TEXT',
        name: t,
        plainText: null,
        reference: null,
        richText: null,
        slug,
      },
    ],
  }
}

export function adaptProductDetail(p: NestProductDetail): ProductDetailNode {
  const media = p.images.map((img) => ({
    id: img.id,
    url: absUrl(img.url),
    alt: p.name,
  }))
  // Если у товара нет общих изображений — берём из первого варианта
  if (!media.length && p.variants[0]?.images?.length) {
    for (const img of p.variants[0].images) {
      media.push({ id: img.id, url: absUrl(img.url), alt: p.name })
    }
  }
  const thumbUrl = media[0]?.url || ''
  const edges = p.variants.map(mapVariantNode)
  const noteHtml = p.vspomniNoteHtml ?? p.mirafloresNoteHtml ?? ''

  const cardAromas = (p.cardAromaLabels ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)

  const aromaNotes = buildProductNotes(p.aromaNotes, uploadsUrl)

  const attributes = [
    htmlAttr('korotkoe-opisanie-tovara', 'Короткое описание', p.shortDescription),
    cardAromas.length
      ? {
          attribute: {
            id: 'aromaty-v-kartochke-tovara',
            name: 'Ароматы в карточке товара',
            slug: 'aromaty-v-kartochke-tovara',
            metadata: [] as unknown[],
          },
          values: cardAromas.map((name, i) => ({
            boolean: null,
            date: null,
            dateTime: null,
            externalReference: null,
            inputType: 'DROPDOWN',
            name,
            plainText: null,
            reference: null,
            richText: null,
            slug: `card-aroma-${i}`,
          })),
        }
      : null,
    htmlAttr('sostav', 'Состав', p.compositionHtml),
    htmlAttr('harakteristiki', 'Характеристики', p.actionEffectHtml),
  ].filter(Boolean) as NonNullable<ProductDetailNode['attributes']>

  const hasStock = p.variants.some((v) => v.available > 0)

  const node = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    isPublished: true,
    // parseEditorJS ожидает Editor.js JSON → оборачиваем HTML в один paragraph-блок
    description: htmlToRawEditorJsonString(p.descriptionHtml || p.shortDescription || ''),
    descriptionPlaintext: p.shortDescription || '',
    productType: { name: p.productType?.trim() || '' },
    category: p.category
      ? {
          id: p.category.id,
          name: p.category.name,
          slug: p.category.slug,
          parent: p.category.parent ?? null,
        }
      : { id: '', name: '', slug: '' },
    attributes,
    media,
    thumbnail: { url: thumbUrl, alt: p.name },
    productVariants: { edges, totalCount: edges.length },
    pricing: {
      priceRange: {
        start: { net: { amount: p.minPrice ?? 0, currency: 'RUB' } },
        stop: { net: { amount: p.maxPrice ?? 0, currency: 'RUB' } },
      },
    },
    isAvailableForPurchase: hasStock,
    // Nest-specific (optional в ProductDetailNode)
    shortDescription: p.shortDescription || '',
    pageShortDescriptionHtml: p.pageShortDescriptionHtml || '',
    actionEffectHtml: p.actionEffectHtml || '',
    applicationHtml: p.applicationHtml || '',
    compositionHtml: p.compositionHtml || '',
    importantNoteHtml: p.importantNoteHtml || '',
    vspomniNoteHtml: noteHtml || '',
    /** Alias — Mira-совместимое имя поля */
    mirafloresNoteHtml: noteHtml || '',
    storageHtml: p.storageHtml || '',
    purpose: p.purpose || '',
    shelfLife: p.shelfLife || '',
    extraHtml: p.extraHtml || '',
    catalogTags: p.catalogTags ?? [],
    aromaNotes,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    ogImageUrl: p.ogImageUrl ? absUrl(p.ogImageUrl) : null,
    canonicalPath: p.canonicalPath,
    seoNoIndex: p.seoNoIndex,
  }
  return node as unknown as ProductDetailNode
}

// ——— API ———

export type ProductListParams = {
  page?: number
  limit?: number
  category?: string
  tag?: string
  collection?: string
  sort?: string
  priceMin?: number
  priceMax?: number
  sale?: boolean
  /** Batch hydrate — comma-joined on the wire. */
  slugs?: string[]
}

export async function fetchProductList(
  params: ProductListParams,
): Promise<{ items: NestProductCard[]; total: number; page: number; limit: number }> {
  return apiFetch('/catalog/products', {
    query: {
      page: params.page,
      limit: params.limit,
      category: params.category,
      tag: params.tag,
      collection: params.collection,
      sort: params.sort,
      priceMin: params.priceMin,
      priceMax: params.priceMax,
      sale: params.sale ? '1' : undefined,
      slugs: params.slugs?.length ? params.slugs.join(',') : undefined,
    },
  })
}

/** null только для 404; остальные ошибки пробрасываем (иначе 500 Nest выглядит как «нет товара»). */
export async function fetchProductBySlug(slug: string): Promise<NestProductDetail | null> {
  try {
    return await apiFetch<NestProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export async function fetchCategories(): Promise<{ items: NestCategory[] }> {
  if (IS_BROWSER && categoriesCache) return categoriesCache
  if (!IS_BROWSER) {
    const res = await apiFetch<{ items: NestCategory[] }>('/catalog/categories')
    return { items: res.items ?? [] }
  }
  if (!categoriesInflight) {
    categoriesInflight = apiFetch<{ items: NestCategory[] }>('/catalog/categories')
      .then((res) => {
        categoriesCache = { items: res.items ?? [] }
        return categoriesCache
      })
      .finally(() => {
        categoriesInflight = null
      })
  }
  return categoriesInflight
}

/** Узкий список по slug (home Coming Soon / gift) — без полного дерева. */
export async function fetchCategoriesBySlugs(
  slugs: string[],
): Promise<{ items: NestCategory[] }> {
  const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(
    0,
    20,
  )
  if (!unique.length) return { items: [] }
  const res = await apiFetch<{ items: NestCategory[] }>('/catalog/categories', {
    query: { slugs: unique.join(',') },
  })
  return { items: res.items ?? [] }
}

/** Meta (slug/name/cover). Backend по умолчанию без products — чипы каталога. */
export async function fetchCollections(): Promise<{ items: NestCollection[] }> {
  if (IS_BROWSER && collectionsCache) return collectionsCache
  if (!IS_BROWSER) {
    const res = await apiFetch<{ items: NestCollection[] }>('/catalog/collections')
    return { items: res.items ?? [] }
  }
  if (!collectionsInflight) {
    collectionsInflight = apiFetch<{ items: NestCollection[] }>('/catalog/collections')
      .then((res) => {
        collectionsCache = { items: res.items ?? [] }
        return collectionsCache
      })
      .finally(() => {
        collectionsInflight = null
      })
  }
  return collectionsInflight
}

export async function fetchCatalogTags(): Promise<{ items: CatalogTagPublic[] }> {
  if (IS_BROWSER && catalogTagsCache) return catalogTagsCache
  if (!IS_BROWSER) {
    const res = await apiFetch<{ items: CatalogTagPublic[] }>('/catalog/tags')
    return { items: (res.items ?? []).map(mapTag) }
  }
  if (!catalogTagsInflight) {
    catalogTagsInflight = apiFetch<{ items: CatalogTagPublic[] }>('/catalog/tags')
      .then((res) => {
        catalogTagsCache = { items: (res.items ?? []).map(mapTag) }
        return catalogTagsCache
      })
      .finally(() => {
        catalogTagsInflight = null
      })
  }
  return catalogTagsInflight
}

function mapTag(t: CatalogTagPublic): CatalogTagPublic {
  return { ...t, coverImageUrl: t.coverImageUrl ? absUrl(t.coverImageUrl) : null }
}

export async function syncCart(lines: CartSyncLine[]): Promise<CartSyncResponse> {
  return apiJson('/catalog/cart/sync', 'POST', { lines })
}

/** Все страницы списка (до maxLimit). */
export async function fetchAllProductCards(
  params: Omit<ProductListParams, 'page' | 'limit'> = {},
  maxLimit = 500,
): Promise<NestProductCard[]> {
  const pageSize = 100
  const all: NestProductCard[] = []
  let page = 1
  while (all.length < maxLimit) {
    const res = await fetchProductList({ ...params, page, limit: pageSize })
    const batch = res.items ?? []
    all.push(...batch)
    if (batch.length < pageSize || all.length >= (res.total ?? 0)) break
    page += 1
  }
  return all.slice(0, maxLimit)
}

/** Slug коллекции по slug/имени (Saleor GID больше не используется). */
export async function resolveCollectionSlug(hint: string): Promise<string | null> {
  const { items } = await fetchCollections()
  const h = hint.trim().toLowerCase()
  const exact = items.find((c) => c.slug.toLowerCase() === h)
  if (exact) return exact.slug
  const fuzzy = items.find(
    (c) => c.slug.toLowerCase().includes(h) || c.name.toLowerCase().includes(h),
  )
  return fuzzy?.slug ?? null
}
