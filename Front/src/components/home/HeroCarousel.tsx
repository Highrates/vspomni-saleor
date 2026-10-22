'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import Image from 'next/image'
import {
  HeroPlaqueOverlay,
  HeroSlideLink,
  type HeroSlideView,
} from './HeroSlideShared'

export type { HeroSlideView }

type CarouselProps = {
  slides: HeroSlideView[]
  paginationEnabled: boolean
  className: string
  imagePosition?: 'center' | 'top'
}

/** Swiper-карусель героя — отдельный чанк (не в LCP-бандле). */
export default function HeroCarousel({
  slides,
  paginationEnabled,
  className,
  imagePosition = 'center',
}: CarouselProps) {
  const imgClass =
    imagePosition === 'top'
      ? 'object-cover object-top'
      : 'object-cover object-center'

  return (
    <Swiper
      modules={[Pagination]}
      pagination={{
        clickable: true,
        dynamicBullets: true,
        enabled: paginationEnabled,
      }}
      spaceBetween={0}
      slidesPerView={1}
      grabCursor
      allowTouchMove
      simulateTouch
      threshold={5}
      touchRatio={1}
      preventClicks={false}
      preventClicksPropagation={false}
      className={className}
    >
      {slides.map((slide, index) => {
        const slideHref = slide.slideHref?.trim()
        const isLcp = index === 0
        const imageEl = (
          <Image
            src={slide.image}
            alt=""
            fill
            sizes="100vw"
            priority={isLcp}
            fetchPriority={isLcp ? 'high' : 'auto'}
            className={imgClass}
          />
        )
        return (
          <SwiperSlide key={slide.id}>
            <div className="relative h-full min-h-full w-full overflow-hidden rounded-[12px] sm:rounded-2xl md:rounded-[20px]">
              {slideHref ? (
                <HeroSlideLink
                  href={slideHref}
                  className="absolute inset-0 z-0 block cursor-pointer"
                  ariaLabel="Перейти"
                >
                  {imageEl}
                </HeroSlideLink>
              ) : (
                imageEl
              )}
              {slide.plaque ? <HeroPlaqueOverlay plaque={slide.plaque} /> : null}
            </div>
          </SwiperSlide>
        )
      })}
    </Swiper>
  )
}
