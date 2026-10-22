'use client'

import { useEffect, useState } from 'react'
import { NOSE_HOME_LIMIT } from '@vspomni/catalog-constants'
import ProductCard from '@/components/home/ProductCard'
import { ProductCardItem } from '@/types/product'
import { getProductsByCollectionId } from '@/graphql/queries/product.service'
import { interleaveProductsByCategoryAndAroma } from '@/lib/product/interleaveProducts'

const COLLECTION_NOSE_ID = 'Q29sbGVjdGlvbjo1' // Ваши носовые сосочки будут в восторге
const TITLE = 'Ваши носовые сосочки будут в восторге'

type Props = {
  /** Товары с RSC (лимит ~12) — без client waterfall. */
  initialProducts?: ProductCardItem[]
}

function NoseSkeleton() {
  return (
    <section className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 mb-4 sm:mb-6 md:mb-8 lg:mb-10 px-0 py-2">
      <h2 className="text-xl sm:text-[36px] md:text-[42px] lg:text-[48px] font-semibold select-none mb-4 sm:mb-6">
        {TITLE}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-gray-200 aspect-[3/4] animate-pulse"
          />
        ))}
      </div>
    </section>
  )
}

export default function CollectionNoseBlock({ initialProducts }: Props) {
  const fromServer = initialProducts !== undefined
  const [products, setProducts] = useState<ProductCardItem[]>(
    initialProducts ?? [],
  )
  const [loading, setLoading] = useState(!fromServer)

  useEffect(() => {
    if (fromServer) {
      setProducts(initialProducts ?? [])
      setLoading(false)
      return
    }
    let cancelled = false
    const fetchProducts = async () => {
      try {
        const data = await getProductsByCollectionId(
          COLLECTION_NOSE_ID,
          NOSE_HOME_LIMIT,
        )
        if (!cancelled && data.length > 0) {
          setProducts(
            interleaveProductsByCategoryAndAroma(data, NOSE_HOME_LIMIT),
          )
        }
      } catch (error) {
        console.error('CollectionNoseBlock: failed to fetch products', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchProducts()
    return () => {
      cancelled = true
    }
  }, [fromServer, initialProducts])

  // SSR с данными — сразу сетка (без null / без ожидания mount).
  if (fromServer && products.length > 0) {
    return (
      <section className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 mb-4 sm:mb-6 md:mb-8 lg:mb-10 px-0 py-2">
        <h2 className="text-xl sm:text-[36px] md:text-[42px] lg:text-[48px] font-semibold select-none mb-4 sm:mb-5 md:mb-6">
          {TITLE}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 p-2 -m-2">
          {products.map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
      </section>
    )
  }

  // Клиентский fetch или dynamic() loading → skeleton с тем же заголовком/высотой.
  if (loading) return <NoseSkeleton />

  // SSR пусто / клиент без данных — не резервируем место.
  if (products.length === 0) return null

  return (
    <section className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 mb-4 sm:mb-6 md:mb-8 lg:mb-10 px-0 py-2">
      <h2 className="text-xl sm:text-[36px] md:text-[42px] lg:text-[48px] font-semibold select-none mb-4 sm:mb-5 md:mb-6">
        {TITLE}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 p-2 -m-2">
        {products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    </section>
  )
}
