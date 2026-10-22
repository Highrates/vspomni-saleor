'use client'

import { useEffect, useRef } from 'react'
import AllAromasItem from '@/components/home/AllAromasItem'
import type { AllAromasItem as AllAromasItemType } from '@/graphql/queries/allAromas.service'
import { useAllAromasStore } from '@/stores/useAllAromas'

type Props = {
  /** Ароматы с RSC — без client waterfall. */
  initialItems?: AllAromasItemType[]
}

export default function ProductGrid({ initialItems }: Props) {
  const { items, setItems, fetchItems } = useAllAromasStore()
  const sectionRef = useRef<HTMLElement>(null)
  const fromServer = initialItems !== undefined

  useEffect(() => {
    if (fromServer) {
      setItems(initialItems ?? [])
      return
    }
    void fetchItems()
  }, [fromServer, initialItems, setItems, fetchItems])

  // При переходе с другой страницы по «Ароматы» (/#vse-aromaty) скролл срабатывает до отрисовки — повторяем после монтирования
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#vse-aromaty') return
    const el = sectionRef.current
    if (!el) return
    const timer = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  const list = items.length > 0 ? items : initialItems ?? []

  return (
    <section
      id="vse-aromaty"
      ref={sectionRef}
      className="mt-4 mb-2 sm:mt-6 sm:mb-3 md:mt-8 md:mb-4 lg:mt-10 lg:mb-5 px-0 py-2 scroll-mt-20"
      style={{ scrollMarginTop: '80px' }}
    >
      <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6">
        <h2 className="text-xl sm:text-[36px] md:text-[42px] lg:text-[48px] font-semibold select-none">
          Все ароматы Вспомни.
        </h2>
      </div>
      {/* Mobile: 2 кол.; sm–md: 3; lg+: 5 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5 md:gap-6 p-1 sm:p-2 -m-1 sm:-m-2">
        {list.map((item) => (
          <div key={item.id} className="w-full min-w-0">
            <AllAromasItem item={item} />
          </div>
        ))}
      </div>
    </section>
  )
}
