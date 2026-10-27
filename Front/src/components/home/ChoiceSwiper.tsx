'use client'

import ChoiceCard from './ChoiceCard'
import StarStyleSwiper from './StarStyleSwiper'
import type { StarChoiceItem } from '@/types/product'

type Props = {
  products: StarChoiceItem[]
}

export default function ChoiceSwiper({ products }: Props) {
  return (
    <StarStyleSwiper
      slides={products.map((product) => ({
        key: product.id,
        node: <ChoiceCard product={product} />,
      }))}
    />
  )
}
