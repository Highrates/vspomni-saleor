import { cache } from 'react'
import { fetchCategoriesBySlugs } from '@/api/catalogApi'
import { uploadsUrl } from '@/api/apiClient'
import type { Category } from '@/types/category'
import {
  COMING_SOON_CATEGORY_SLUGS,
  GIFT_PACKAGES_CATEGORY_SLUG,
  pickComingSoonCategories,
  pickGiftPackagesCategory,
} from '@/lib/category/catalogCategories'

function mapLite(c: {
  id: string
  name: string
  slug: string
  imageUrl?: string | null
}): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: '',
    backgroundImage: uploadsUrl(c.imageUrl) || '',
  }
}

/**
 * Только 2–3 категории для Coming Soon + подарочные пакеты.
 * Узкий `GET /catalog/categories?slugs=…` — без дерева на 100.
 */
export const loadHomeCategoryPicks = cache(async () => {
  const slugs = [
    ...COMING_SOON_CATEGORY_SLUGS,
    GIFT_PACKAGES_CATEGORY_SLUG,
  ]
  try {
    const { items } = await fetchCategoriesBySlugs(slugs)
    const mapped = (items ?? []).map(mapLite)
    return {
      comingSoon: pickComingSoonCategories(mapped),
      giftPackages: pickGiftPackagesCategory(mapped),
    }
  } catch {
    return { comingSoon: [] as Category[], giftPackages: null as Category | null }
  }
})
