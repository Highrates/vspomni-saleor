import Image from 'next/image'
import StarStyleCard from './StarStyleCard'
import type { StarChoiceItem } from '@/types/product'

export interface ChoiceCardProps {
  product: StarChoiceItem
}

const FALLBACK_IMAGE = '/images/choice-1.jpg'

export default function ChoiceCard({ product }: ChoiceCardProps) {
  const mainSrc = product.image || FALLBACK_IMAGE

  return (
    <StarStyleCard
      item={{
        name: product.name,
        size: product.size,
        thumbnail: product.thumbnail || product.image || FALLBACK_IMAGE,
        price: product.price,
        oldPrice: product.oldPrice,
        star: product.star,
        date: product.date,
        slug: product.slug,
        categorySlug: product.categorySlug,
        cartId: product.id,
        cartImage: product.image || product.thumbnail,
      }}
      media={
        <Image
          src={mainSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 498px"
          className="object-cover"
        />
      }
    />
  )
}
