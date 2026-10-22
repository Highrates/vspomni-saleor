'use client'

import ChoiceCard from './ChoiceCard'
import { useEffect, useState, type ComponentType } from 'react'
import type { StarChoiceItem } from '@/types/product'

interface ChoiceProps {
  /** Товары с RSC — единственный источник данных */
  initialProducts?: StarChoiceItem[]
}

function ChoiceScrollFallback({ products }: { products: StarChoiceItem[] }) {
  if (products.length === 0) return null
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-10 rounded-[20px] sm:gap-5 md:gap-[22px] lg:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-choice-fallback
    >
      {products.map((product) => (
        <div
          key={product.id}
          className="w-[calc(100vw-48px)] shrink-0 sm:w-[340px] md:w-[420px] lg:w-[420px]"
        >
          <ChoiceCard product={product} />
        </div>
      ))}
    </div>
  )
}

export default function Choice({ initialProducts = [] }: ChoiceProps) {
  const [SwiperComponent, setSwiperComponent] =
    useState<ComponentType<{ products: StarChoiceItem[] }> | null>(null)

  useEffect(() => {
    let cancelled = false
    import('./ChoiceSwiper')
      .then((m) => {
        if (!cancelled) setSwiperComponent(() => m.default)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 py-2 px-0">
      <h2 className="text-xl sm:text-[36px] md:text-[42px] lg:text-[48px] font-semibold text-black mb-6 sm:mb-8 flex items-center gap-2">
        Выбор{' '}
        <span className="text-[20px] sm:text-[24px] leading-none">⭐</span>
      </h2>

      {initialProducts.length === 0 ? null : SwiperComponent ? (
        <SwiperComponent products={initialProducts} />
      ) : (
        <ChoiceScrollFallback products={initialProducts} />
      )}
    </section>
  )
}
