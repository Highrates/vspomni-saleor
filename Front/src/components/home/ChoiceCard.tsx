import Image from 'next/image'
import AddCartBtn from '../ui/addCartBtn'
import Link from 'next/link'
import { StarChoiceItem } from '@/types/product'
import { productDetailPath } from '@/lib/productPaths'

export interface ChoiceCardProps {
  product: StarChoiceItem
}

const FALLBACK_IMAGE = '/images/choice-1.jpg'

export default function ChoiceCard({ product }: ChoiceCardProps) {
  const mainSrc = product.image || FALLBACK_IMAGE
  const thumbSrc = product.thumbnail || product.image || FALLBACK_IMAGE

  return (
    <div className="relative w-full rounded-[20px] overflow-hidden">
      <div className="relative w-full aspect-[498/685] bg-gray-100">
        <Image
          src={mainSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 498px"
          className="object-cover"
        />

        {/* Имя и дата над плашкой */}
        {(product.star || product.date) && (
          <div className="absolute left-[16px] bottom-[86px] text-white text-[14px] leading-[18px] font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] select-none">
            {[product.star, product.date].filter(Boolean).join(' • ')}
          </div>
        )}

        {/* Плашка с товаром */}
        <div className="absolute left-[8px] right-[8px] bottom-[8px] flex items-center gap-[10px] p-[8px] bg-white rounded-[12px]">
          <div className="relative w-[57px] h-[52px] rounded-[4px] overflow-hidden bg-gray-50 shrink-0">
            <Image
              src={thumbSrc}
              alt={product.name}
              fill
              sizes="57px"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col flex-1 min-w-0 justify-between h-[52px]">
            {(() => {
              const href = productDetailPath(product)
              if (!href) {
                return (
                  <span className="text-[16px] leading-[22px] font-semibold text-black truncate">
                    {product.name}
                  </span>
                )
              }
              return (
                <Link
                  href={href}
                  className="text-[16px] leading-[22px] font-semibold text-black truncate"
                >
                  {product.name}
                </Link>
              )
            })()}

            <div className="flex items-center gap-[6px] whitespace-nowrap">
              {Boolean(product.oldPrice && product.oldPrice > product.price) && (
                <span className="text-[15px] leading-[20px] font-semibold text-black/30 line-through whitespace-nowrap">
                  {product.oldPrice} ₽
                </span>
              )}

              {product.price && (
                <span className="text-[15px] leading-[20px] font-semibold text-black whitespace-nowrap">
                  {product.price} ₽
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <AddCartBtn
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                size: product.size,
                thumbnail: product.thumbnail,
                image: product.image,
                price: product.price,
                group: [],
                aromas: [],
              }}
              size={product.size}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
