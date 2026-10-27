import { formatChoiceStarDate } from '@vspomni/catalog-constants'
import type { NestUnpackingReel } from '@/api/settingsApi'
import type { UnpackingReelItem } from '@/types/unpacking'

export function mapUnpackingReel(it: NestUnpackingReel): UnpackingReelItem {
  const thumb =
    it.product.imageUrl ||
    it.product.coverImageUrl ||
    it.posterUrl ||
    ''
  return {
    id: it.id,
    videoUrl: it.videoUrl,
    posterUrl: it.posterUrl,
    captionName: (it.captionName || '').trim(),
    captionDate: formatChoiceStarDate(it.captionDate),
    name: it.product.name,
    size: it.product.variantName || '',
    thumbnail: thumb,
    price: it.product.price ?? 0,
    oldPrice:
      it.product.oldPrice != null && it.product.oldPrice > (it.product.price ?? 0)
        ? it.product.oldPrice
        : 0,
    slug: it.product.slug,
    categorySlug: it.product.categorySlug?.trim() || undefined,
    variantId: it.product.variantId ?? null,
  }
}
