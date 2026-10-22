'use client'

import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

type Props = {
  images: string[]
  productName: string
}

/** Swiper галереи карточки — отдельный чанк, грузится по hover/gesture. */
export default function ProductCardGallery({ images, productName }: Props) {
  return (
    <Swiper
      modules={[Pagination]}
      pagination={{
        clickable: true,
        dynamicBullets: true,
      }}
      spaceBetween={0}
      slidesPerView={1}
      allowTouchMove
      grabCursor
      className="product-card-swiper h-full w-full rounded-[12px] sm:rounded-[16px]"
    >
      {images.map((src, index) => (
        <SwiperSlide key={index} className="relative h-full">
          <div className="relative h-full w-full">
            <Image
              src={src}
              alt={index === 0 ? productName : ''}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1600px) 25vw, 369px"
              className="rounded-[12px] object-cover sm:rounded-[16px]"
              draggable={false}
            />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
