import { UNPACKING_CAROUSEL_LIMIT } from '@vspomni/catalog-constants'
import { getUnpackingReels } from '@/api/settingsApi'
import { mapUnpackingReel } from '@/lib/unpacking/mapUnpackingReel'
import type { UnpackingReelItem } from '@/types/unpacking'

export type UnpackingHomePayload = {
  items: UnpackingReelItem[]
  total: number
}

/**
 * Рилсы «Распаковка» для главной — REST `/settings/unpacking`.
 * (Не класть в graphql/queries: это не GraphQL, как loadHeroSlides.)
 */
export async function getUnpackingHomeReels(): Promise<UnpackingHomePayload> {
  try {
    const page = await getUnpackingReels({
      limit: UNPACKING_CAROUSEL_LIMIT,
      offset: 0,
    })
    return {
      items: page.items
        .filter((it) => Boolean(it.videoUrl?.trim()))
        .map(mapUnpackingReel),
      total: page.total,
    }
  } catch {
    return { items: [], total: 0 }
  }
}
