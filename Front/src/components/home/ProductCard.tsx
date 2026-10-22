'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import {
  useCallback,
  useState,
  type ComponentType,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import AddCartBtn from '@/components/ui/addCartBtn'
import { ProductCardItem } from '@/types/product'
import { productDetailPath } from '@/lib/productPaths'

interface ProductCardProps {
  product: ProductCardItem
  /** @deprecated используйте product.badgeLabel из админки */
  isNew?: boolean
  /** Скрыть строку с ароматами (используем для категории «Подарочные пакеты») */
  hideAromas?: boolean
}

type GalleryProps = { images: string[]; productName: string }

export default function ProductCard({
  product,
  isNew = false,
  hideAromas = false,
}: ProductCardProps) {
  const detailHref = productDetailPath(product)
  const images =
    product.gallery && product.gallery.length > 0
      ? product.gallery
      : [product.image].filter(Boolean)

  const singleImage = images.length <= 1
  const badgeText =
    (product.badgeLabel && product.badgeLabel.trim()) || (isNew ? 'NEW' : '')

  const [Gallery, setGallery] = useState<ComponentType<GalleryProps> | null>(
    null,
  )

  const enableGallery = useCallback(() => {
    if (singleImage || Gallery) return
    void import('./ProductCardGallery')
      .then((m) => setGallery(() => m.default))
      .catch(() => {})
  }, [singleImage, Gallery])

  const onMediaPointerDown = useCallback(
    (e: PointerEvent) => {
      if (singleImage) return
      // Только touch/pen: на mouse hover раньше подменяли Image→Swiper и картинка мигала
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        enableGallery()
      }
    },
    [singleImage, enableGallery],
  )

  if (!detailHref) {
    return null
  }

  const cardBody = (
    <>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-neutral-50 sm:aspect-[369/384] sm:rounded-[16px]"
        onPointerDown={onMediaPointerDown}
      >
        {Gallery && !singleImage ? (
          <Gallery images={images} productName={product.name} />
        ) : images[0] ? (
          <Image
            src={images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1600px) 25vw, 369px"
            className="rounded-[12px] object-cover sm:rounded-[16px]"
            draggable={false}
          />
        ) : null}

        <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col items-start gap-1 sm:top-3 sm:left-3">
          {badgeText ? (
            <div className="select-none rounded-md bg-[#E91E63] px-2 py-0.5 text-[10px] font-semibold text-white uppercase sm:text-xs">
              {badgeText}
            </div>
          ) : null}
          {product.discountPercent && product.discountPercent > 0 && (
            <div className="select-none rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white sm:text-xs">
              -{product.discountPercent}%
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-2 left-2 z-10 select-none rounded-full border border-neutral-200 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-black/70 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:px-2 sm:text-[12px]">
          {product.size}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1 px-0.5 pt-2 pb-2 sm:gap-2 sm:px-1 sm:pt-3 sm:pb-4">
        <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
          {!hideAromas && product.aromas && product.aromas.length > 0 && (
            <p className="text-[11px] text-neutral-500 sm:text-xs">
              {product.aromas.join('  ')}
            </p>
          )}

          <h3 className="cursor-pointer [hyphens:auto] line-clamp-2 break-words text-[12px] leading-[1.2] font-semibold text-brand select-none sm:text-base lg:text-lg">
            {product.name}
          </h3>
        </div>

        <div className="mt-auto flex w-full items-center justify-between pt-1 sm:pt-2">
          <div className="flex items-center gap-1.5">
            <span className="sm:hidden flex items-center gap-1">
              <ShoppingBag size={14} className="text-neutral-600" />
            </span>
            <div className="flex flex-col items-start">
              {product.oldPrice && product.oldPrice > product.price && (
                <p className="text-[11px] text-neutral-400 line-through">
                  {product.oldPrice.toLocaleString('ru-RU')} ₽
                </p>
              )}
              <p className="text-brand text-sm sm:text-[15px] font-semibold select-none">
                {product.price.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>

          <div
            className="hidden sm:block shrink-0"
            onClick={(e: MouseEvent) => e.preventDefault()}
          >
            <AddCartBtn
              product={product}
              size={product.size}
              variantId={product.variantId}
            />
          </div>
        </div>

        <div
          className="sm:hidden mt-2 w-full"
          onClick={(e: MouseEvent) => e.preventDefault()}
        >
          <AddCartBtn
            product={product}
            size={product.size}
            variantId={product.variantId}
            mobileRow
          />
        </div>
      </div>
    </>
  )

  return (
    <Link
      href={detailHref}
      className="flex h-full flex-col rounded-xl bg-white"
      draggable={false}
    >
      {cardBody}
    </Link>
  )
}
