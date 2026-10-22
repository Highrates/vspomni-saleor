'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ProductCard from '@/components/home/ProductCard'
import { ProductCardItem } from '@/types/product'
import { usePopularScentsStore } from '@/stores/usePopularScents'

type Props = {
  /** Заголовок над сеткой товаров */
  title?: string
  /** На главной — H1 для SEO; на остальных страницах H2 */
  heading?: 'h1' | 'h2'
  /** Товары с RSC (главная) — без client fetch. */
  initialProducts?: ProductCardItem[]
}

export default function PopularScentsAlt({
  title = 'Диффузоры для дома',
  heading = 'h2',
  initialProducts,
}: Props) {
  const { greed, setGrid, fetchGrid } = usePopularScentsStore()
  const Heading = heading
  const fromServer = initialProducts !== undefined

  useEffect(() => {
    if (fromServer) {
      setGrid(initialProducts ?? [])
      return
    }
    void fetchGrid()
  }, [fromServer, initialProducts, setGrid, fetchGrid])

  const list = (greed.length > 0 ? greed : initialProducts ?? []).slice(0, 4)

  return (
    <section className="mb-4 mt-4 px-0 py-2 sm:mb-6 sm:mt-6 sm:px-6 md:mb-8 md:mt-8 md:px-8 lg:mb-10 lg:mt-10">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5 md:mb-6">
        <Heading className="min-w-0 flex-1 text-[22px] font-semibold leading-tight select-none sm:text-[36px] md:text-[42px] lg:text-[48px]">
          {title}
        </Heading>
        <Link
          href="/category/diffuzory"
          className="flex shrink-0 items-center gap-1 whitespace-nowrap text-base font-medium text-black"
          aria-label="Смотреть все диффузоры для дома"
        >
          <span className="hidden text-md font-medium sm:inline">
            Смотреть все
          </span>
          <Image
            src="/to_right.svg"
            alt=""
            aria-hidden
            width={20}
            height={24}
            className="h-auto w-auto"
          />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
        {list.map((product: ProductCardItem) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    </section>
  )
}
