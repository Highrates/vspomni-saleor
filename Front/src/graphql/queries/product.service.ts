/**
 * Товары — Nest `/api/v1/catalog/*`.
 * Экспорты и сигнатуры сохранены от Saleor-версии, чтобы страницы/сторы не менялись.
 */
import {
  ApiError,
  uploadsUrl,
} from '@/api/apiClient'
import {
  CHOICE_CAROUSEL_LIMIT,
  CHOICE_COLLECTION_SLUG as NEST_CHOICE_COLLECTION_SLUG,
  NOSE_HOME_LIMIT,
  POPULAR_HOME_LIMIT,
} from '@vspomni/catalog-constants'
import {
  NEW_COLLECTION_SLUG,
  POPULAR_COLLECTION_SLUG,
  adaptProductDetail,
  cardToProductCardItem,
  cardToStarChoiceItem,
  fetchAllProductCards,
  fetchCatalogTags,
  fetchProductBySlug,
  fetchProductList,
  resolveCollectionSlug,
} from '@/api/catalogApi'
import { interleaveProductsByCategoryAndAroma } from '@/lib/product/interleaveProducts'
import type { Connection, WarehouseNode } from '../types/core.types'
import type { ProductDetailNode, ProductNode } from '../types/product.types'
import type { ProductCardItem, StarChoiceItem } from '@/types/product'
import { isValidSlug } from '@/lib/productPaths'

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function filterValidProductCards(items: ProductCardItem[]): ProductCardItem[] {
  return items.filter((item) => isValidSlug(item.slug))
}

/** Saleor GID коллекций, которые ещё зашиты в UI → slug в Nest. */
const LEGACY_COLLECTION_GID_TO_SLUG: Record<string, string> = {
  // «Популярное»
  Q29sbGVjdGlvbjoz: POPULAR_COLLECTION_SLUG,
  // «Ваши носовые сосочки будут в восторге» (CollectionNoseBlock)
  Q29sbGVjdGlvbjo1: NEW_COLLECTION_SLUG,
}

function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404
}

// -----------------------------------------------------------
// A. Single product
// -----------------------------------------------------------

/** Nest `GET /catalog/products/:slug` → Saleor-подобный `ProductDetailNode`. 404 → null. */
export async function getSingleProduct(
  slug: string,
): Promise<ProductDetailNode | null> {
  const detail = await fetchProductBySlug(slug)
  return detail ? adaptProductDetail(detail) : null
}

/** Имя товара и категории для крошек (server) */
export async function getProductBreadcrumbMeta(productSlug: string): Promise<{
  productName: string
  categoryName: string | null
  categorySlug: string | null
} | null> {
  try {
    const p = await fetchProductBySlug(productSlug)
    if (!p?.name) return null
    return {
      productName: p.name,
      categoryName: p.category?.name?.trim() || null,
      categorySlug: p.category?.slug?.trim() || null,
    }
  } catch {
    return null
  }
}

/** Для редиректа /product/slug → /category/{cat}/slug (server) */
export async function getProductCategorySlugForRedirect(
  productSlug: string,
): Promise<string | null> {
  try {
    const p = await fetchProductBySlug(productSlug)
    return p?.category?.slug?.trim() || null
  } catch {
    return null
  }
}

/** Список товаров как `Connection<ProductNode>` (isPublished игнорируется — Nest отдаёт только активные). */
export async function getFilteredProducts(
  first = 20,
  _isPublished?: boolean,
): Promise<Connection<ProductNode>> {
  const res = await fetchProductList({ limit: first, page: 1 })
  return {
    edges: (res.items ?? []).map((c) => {
      const thumb = uploadsUrl(c.imageUrl) || ''
      return {
        node: {
          id: c.id,
          name: c.name,
          slug: c.slug,
          isPublished: true,
          thumbnail: { url: thumb, alt: c.name },
          media: (c.imageUrls ?? []).map((u, i) => ({
            id: `${c.id}-${i}`,
            alt: c.name,
            url: uploadsUrl(u) || u,
          })),
        } as ProductNode,
      }
    }),
    pageInfo: {
      hasNextPage: (res.total ?? 0) > first,
      hasPreviousPage: false,
      endCursor: null,
    },
  }
}

// -----------------------------------------------------------
// B. Inventory (stubs — склады Saleor в Nest не используются)
// -----------------------------------------------------------

export async function getAllWarehouses(
  _first = 50,
): Promise<Connection<WarehouseNode>> {
  return {
    edges: [],
    pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
  }
}

// -----------------------------------------------------------
// C. Discounts / mutations (stubs)
// -----------------------------------------------------------

/**
 * Скидки кампаний уже включены в `price/oldPrice/discountPercent` Nest.
 * Возвращаем пустую карту: UI тогда использует oldPrice из самих данных.
 */
export async function getCatalogDiscounts(
  _variantIds: string[],
  _channel?: string,
): Promise<Record<string, number>> {
  return {}
}

/** Редактирование товара с витрины не поддерживается (админка — отдельное приложение). No-op. */
export async function updateProductName(
  productId: string,
  newName: string,
): Promise<ProductNode> {
  return { id: productId, name: newName, slug: '' } as ProductNode
}

// -----------------------------------------------------------
// D. Product lists
// -----------------------------------------------------------

/** Сетка товаров (главная): первые 12 из каталога. */
export async function getGreedProducts(): Promise<any> {
  const res = await fetchProductList({ limit: 12, page: 1 })
  return filterValidProductCards((res.items ?? []).map((c) => cardToProductCardItem(c)))
}

/** «Популярное»: коллекция `populiarnye`, fallback — `koe-chto-novoe-dlia-vas`. */
export async function getPopularProducts(
  limit: number = POPULAR_HOME_LIMIT,
): Promise<ProductCardItem[]> {
  const cap = Math.min(Math.max(1, limit), 12)
  let res = await fetchProductList({
    collection: POPULAR_COLLECTION_SLUG,
    limit: cap,
    page: 1,
  })
  if (!res.items?.length) {
    res = await fetchProductList({
      collection: NEW_COLLECTION_SLUG,
      limit: cap,
      page: 1,
    })
  }
  return filterValidProductCards(
    (res.items ?? []).map((c) => cardToProductCardItem(c)),
  ).slice(0, cap)
}

/** «Носовые сосочки» на главной — лимит + чередование категорий. */
export async function getNoseHomeProducts(
  limit: number = NOSE_HOME_LIMIT,
): Promise<ProductCardItem[]> {
  const cap = Math.min(Math.max(1, limit), 24)
  const data = await getProductsByCollectionId('Q29sbGVjdGlvbjo1', cap)
  return interleaveProductsByCategoryAndAroma(data, cap)
}

export type CatalogProductsPage = {
  products: ProductCardItem[]
  hasNextPage: boolean
  /** Nest: номер следующей страницы строкой (аналог курсора Saleor) */
  endCursor: string | null
}

/**
 * Одна страница каталога (для /catalog и «Показать ещё»).
 * `after` — `endCursor` предыдущей страницы (номер страницы).
 */
export async function getCatalogProductsPage(
  pageSize: number,
  after?: string | null,
): Promise<CatalogProductsPage> {
  const page = after && Number(after) > 0 ? Number(after) : 1
  const res = await fetchProductList({ page, limit: pageSize })
  const items = res.items ?? []
  const hasNextPage = page * pageSize < (res.total ?? 0) && items.length > 0
  return {
    products: filterValidProductCards(items.map((c) => cardToProductCardItem(c))),
    hasNextPage,
    endCursor: hasNextPage ? String(page + 1) : null,
  }
}

export async function getCatalogAllProducts(
  maxProducts: number = 500,
): Promise<ProductCardItem[]> {
  const cards = await fetchAllProductCards({}, maxProducts)
  return filterValidProductCards(cards.map((c) => cardToProductCardItem(c)))
}

/** Коллекция «Выбор ⭐» */
export const CHOICE_COLLECTION_SLUG = NEST_CHOICE_COLLECTION_SLUG

/** Товары коллекции «Выбор ⭐» (slug: vybor) — лимит под карусель, не весь каталог. */
export async function getChoiceProducts(
  limit: number = CHOICE_CAROUSEL_LIMIT,
): Promise<StarChoiceItem[]> {
  const cap = Math.min(Math.max(1, limit), 24)
  const { items } = await fetchProductList({
    collection: CHOICE_COLLECTION_SLUG,
    page: 1,
    limit: cap,
  })
  return (items ?? [])
    .filter((c) => c.imageUrl || (c.imageUrls?.length ?? 0) > 0)
    .map(cardToStarChoiceItem)
}

/**
 * Товары коллекции. Принимает slug Nest или legacy Saleor GID (см. LEGACY_COLLECTION_GID_TO_SLUG).
 * @param first — лимит (если не задан, тянем всю коллекцию).
 */
export async function getProductsByCollectionId(
  collectionId: string = 'Q29sbGVjdGlvbjo1',
  first?: number,
): Promise<ProductCardItem[]> {
  const hint = LEGACY_COLLECTION_GID_TO_SLUG[collectionId] ?? collectionId
  const slug = (await resolveCollectionSlug(hint)) ?? null
  if (!slug) return []
  const cap = typeof first === 'number' && first > 0 ? first : 500
  const cards = await fetchAllProductCards({ collection: slug }, cap)
  return filterValidProductCards(cards.map((c) => cardToProductCardItem(c)))
}

/** Товары по slug аромата (= `CatalogTag.slug`). */
export async function getProductsByAromaSlug(aromaSlug: string): Promise<ProductCardItem[]> {
  try {
    const cards = await fetchAllProductCards({ tag: aromaSlug }, 200)
    return filterValidProductCards(
      cards.map((c) => cardToProductCardItem(c)),
    )
  } catch (e) {
    console.error('getProductsByAromaSlug error:', e)
    return []
  }
}

/** Товары по имени аромата (fallback): имя → тег → фильтр по тегу. */
export async function getProductsByAromaValue(aromaName: string): Promise<ProductCardItem[]> {
  try {
    const needle = aromaName.trim().toLowerCase()
    if (!needle) return []
    const { items } = await fetchCatalogTags()
    const tag = items.find(
      (t) => t.name.trim().toLowerCase() === needle || t.title?.trim().toLowerCase() === needle,
    )
    if (!tag) return []
    return await getProductsByAromaSlug(tag.slug)
  } catch (e) {
    console.error('getProductsByAromaValue error:', e)
    return []
  }
}

/** Товары категории (Nest `?category=`). Неизвестная категория → []. */
export async function getProductsByCategorySlug(categorySlug: string): Promise<any> {
  try {
    const cards = await fetchAllProductCards({ category: categorySlug }, 200)
    return filterValidProductCards(
      cards.map((c) => cardToProductCardItem(c, { categorySlug })),
    )
  } catch (e) {
    if (isNotFound(e)) return []
    throw e
  }
}
