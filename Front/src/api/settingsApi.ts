/**
 * Публичные настройки Nest `/settings/*`.
 * Gratitude / quiz / menu / home-promo / homepage-sets — вне скоупа Vspomni, не подключаем.
 */
import { apiFetch, uploadsUrl } from '@/api/apiClient'

export type SiteSeoSettings = {
  siteUrl: string | null
  titleSuffix: string
  defaultMetaDescription: string | null
  defaultOgImageUrl: string | null
  homeMetaTitle: string | null
  homeMetaDescription: string | null
  homeOgImageUrl: string | null
}

export async function getSiteSeoSettings(): Promise<SiteSeoSettings> {
  const res = await apiFetch<SiteSeoSettings & { id?: string; updatedAt?: string | null }>(
    '/settings/seo',
  )
  return {
    siteUrl: res.siteUrl ?? null,
    titleSuffix: res.titleSuffix?.trim() || 'Vspomni',
    defaultMetaDescription: res.defaultMetaDescription ?? null,
    defaultOgImageUrl: res.defaultOgImageUrl
      ? uploadsUrl(res.defaultOgImageUrl) || res.defaultOgImageUrl
      : null,
    homeMetaTitle: res.homeMetaTitle ?? null,
    homeMetaDescription: res.homeMetaDescription ?? null,
    homeOgImageUrl: res.homeOgImageUrl
      ? uploadsUrl(res.homeOgImageUrl) || res.homeOgImageUrl
      : null,
  }
}

export type NestFaqItem = {
  id: string
  question: string
  answer: string
}

export type NestStorySlide = {
  id: string
  url: string
  mediaType: 'image' | 'video'
  sortOrder: number
}

export type NestStory = {
  id: string
  title: string
  slug: string
  coverUrl: string | null
  sortOrder: number
  active: boolean
  slides: NestStorySlide[]
}

export async function getStories(): Promise<NestStory[]> {
  const res = await apiFetch<{ items: NestStory[] }>('/settings/stories')
  return (res.items ?? []).map((st) => ({
    ...st,
    coverUrl: st.coverUrl ? uploadsUrl(st.coverUrl) || st.coverUrl : null,
    slides: (st.slides ?? []).map((sl) => ({
      ...sl,
      url: uploadsUrl(sl.url) || sl.url,
    })),
  }))
}

export type NestUnpackingReel = {
  id: string
  videoUrl: string
  posterUrl: string
  captionName: string | null
  captionDate: string | null
  product: {
    id: string
    variantId?: string | null
    variantName?: string | null
    slug: string
    name: string
    price: number
    oldPrice?: number | null
    imageUrl?: string | null
    coverImageUrl?: string | null
    categorySlug?: string | null
  }
}

export type UnpackingReelsPage = {
  items: NestUnpackingReel[]
  total: number
  limit: number
  offset: number
}

function mapUnpackingReelUrls(it: NestUnpackingReel): NestUnpackingReel {
  return {
    ...it,
    videoUrl: uploadsUrl(it.videoUrl) || it.videoUrl,
    posterUrl: uploadsUrl(it.posterUrl) || it.posterUrl,
    product: {
      ...it.product,
      imageUrl: it.product.imageUrl
        ? uploadsUrl(it.product.imageUrl) || it.product.imageUrl
        : null,
      coverImageUrl: it.product.coverImageUrl
        ? uploadsUrl(it.product.coverImageUrl) || it.product.coverImageUrl
        : null,
    },
  }
}

export async function getUnpackingReels(opts?: {
  limit?: number
  offset?: number
}): Promise<UnpackingReelsPage> {
  const query: Record<string, string | number> = {}
  if (opts?.limit != null) query.limit = opts.limit
  if (opts?.offset != null) query.offset = opts.offset
  const res = await apiFetch<{
    items: NestUnpackingReel[]
    total?: number
    limit?: number
    offset?: number
  }>('/settings/unpacking', { query })
  const items = (res.items ?? []).map(mapUnpackingReelUrls)
  return {
    items,
    total: res.total ?? items.length,
    limit: res.limit ?? items.length,
    offset: res.offset ?? 0,
  }
}

export async function getFaqItems(): Promise<NestFaqItem[]> {
  const res = await apiFetch<{ items: NestFaqItem[] }>('/settings/faq')
  return res.items ?? []
}

export type CartSettings = {
  freeShippingThresholdRub: number
  progressContentText: string
  progressSuccessText: string
  legalHtml: string
}

export async function getCartSettings(): Promise<CartSettings> {
  return apiFetch('/settings/cart')
}
