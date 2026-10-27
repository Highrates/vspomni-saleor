'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import AddCartBtn from '../ui/addCartBtn'
import { productDetailPath } from '@/lib/productPaths'

export type StarStyleCardItem = {
  name: string
  size: string
  thumbnail: string
  price: number
  oldPrice: number
  star: string
  date: string
  slug: string
  categorySlug?: string
  /** id в AddCartBtn (обычно variantId) */
  cartId: string
  /** превью в корзине */
  cartImage?: string
  variantId?: string | null
}

const FALLBACK_IMAGE = '/images/choice-1.jpg'

type Props = {
  item: StarStyleCardItem
  /** Основное медиа (Image или Video) — absolute inset-0 object-cover */
  media: ReactNode
}

/** Общая плашка «Выбор ⭐» / «Распаковка»: media slot + подпись + cart. */
export default function StarStyleCard({ item, media }: Props) {
  const thumbSrc = item.thumbnail || FALLBACK_IMAGE
  const detailHref = productDetailPath(item)
  const cartImage = item.cartImage || item.thumbnail || FALLBACK_IMAGE

  return (
    <div className="relative w-full rounded-[20px] overflow-hidden">
      <div className="relative w-full aspect-[498/685] bg-gray-100">
        {media}

        {(item.star || item.date) && (
          <div className="absolute left-[16px] bottom-[86px] text-white text-[14px] leading-[18px] font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] select-none">
            {[item.star, item.date].filter(Boolean).join(' • ')}
          </div>
        )}

        <div className="absolute left-[8px] right-[8px] bottom-[8px] flex items-center gap-[10px] p-[8px] bg-white rounded-[12px]">
          <div className="relative w-[57px] h-[52px] rounded-[4px] overflow-hidden bg-gray-50 shrink-0">
            <Image
              src={thumbSrc}
              alt={item.name}
              fill
              sizes="57px"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col flex-1 min-w-0 justify-between h-[52px]">
            {detailHref ? (
              <Link
                href={detailHref}
                className="text-[16px] leading-[22px] font-semibold text-black truncate"
              >
                {item.name}
              </Link>
            ) : (
              <span className="text-[16px] leading-[22px] font-semibold text-black truncate">
                {item.name}
              </span>
            )}

            <div className="flex items-center gap-[6px] whitespace-nowrap">
              {Boolean(item.oldPrice && item.oldPrice > item.price) && (
                <span className="text-[15px] leading-[20px] font-semibold text-black/30 line-through whitespace-nowrap">
                  {item.oldPrice} ₽
                </span>
              )}

              {item.price ? (
                <span className="text-[15px] leading-[20px] font-semibold text-black whitespace-nowrap">
                  {item.price} ₽
                </span>
              ) : null}
            </div>
          </div>

          <div className="shrink-0">
            <AddCartBtn
              product={{
                id: item.cartId,
                name: item.name,
                slug: item.slug,
                size: item.size,
                thumbnail: item.thumbnail,
                image: cartImage,
                price: item.price,
                group: [],
                aromas: [],
              }}
              size={item.size}
              variantId={item.variantId ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
