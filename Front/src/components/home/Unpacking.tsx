'use client'

import { UNPACKING_CAROUSEL_LIMIT } from '@vspomni/catalog-constants'
import UnpackingCard from './UnpackingCard'
import { useEffect, useState, type ComponentType } from 'react'
import { getUnpackingReels } from '@/api/settingsApi'
import { mapUnpackingReel } from '@/lib/unpacking/mapUnpackingReel'
import type { UnpackingReelItem } from '@/types/unpacking'

interface UnpackingProps {
  initialItems?: UnpackingReelItem[]
  initialTotal?: number
}

function UnpackingScrollFallback({ items }: { items: UnpackingReelItem[] }) {
  if (items.length === 0) return null
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-10 rounded-[20px] sm:gap-5 md:gap-[22px] lg:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-unpacking-fallback
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="w-[calc(100vw-48px)] shrink-0 sm:w-[340px] md:w-[420px] lg:w-[420px]"
        >
          <UnpackingCard item={item} />
        </div>
      ))}
    </div>
  )
}

export default function Unpacking({
  initialItems = [],
  initialTotal,
}: UnpackingProps) {
  const [items, setItems] = useState(initialItems)
  const [total, setTotal] = useState(initialTotal ?? initialItems.length)
  const [loadingMore, setLoadingMore] = useState(false)
  const [SwiperComponent, setSwiperComponent] = useState<ComponentType<{
    items: UnpackingReelItem[]
  }> | null>(null)

  useEffect(() => {
    setItems(initialItems)
    setTotal(initialTotal ?? initialItems.length)
  }, [initialItems, initialTotal])

  useEffect(() => {
    let cancelled = false
    import('./UnpackingSwiper')
      .then((m) => {
        if (!cancelled) setSwiperComponent(() => m.default)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function loadMore() {
    if (loadingMore || items.length >= total) return
    setLoadingMore(true)
    try {
      const page = await getUnpackingReels({
        limit: UNPACKING_CAROUSEL_LIMIT,
        offset: items.length,
      })
      const next = page.items
        .filter((it) => Boolean(it.videoUrl?.trim()))
        .map(mapUnpackingReel)
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...next.filter((i) => !seen.has(i.id))]
      })
      setTotal(page.total)
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }

  if (items.length === 0) return null

  const hasMore = items.length < total

  return (
    <section className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 py-2 px-0">
      <h2 className="text-xl sm:text-[36px] md:text-[42px] lg:text-[48px] font-semibold text-black mb-6 sm:mb-8">
        Распаковка
      </h2>

      {SwiperComponent ? (
        <SwiperComponent items={items} />
      ) : (
        <UnpackingScrollFallback items={items} />
      )}

      {hasMore ? (
        <div className="mt-2 flex justify-center sm:mt-4">
          <button
            type="button"
            className="text-sm sm:text-base font-medium text-black underline-offset-4 hover:underline disabled:opacity-50"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? 'Загрузка…' : 'Ещё'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
