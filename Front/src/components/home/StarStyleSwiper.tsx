'use client'

import 'swiper/css'
import 'swiper/css/navigation'
import { Navigation } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Swiper as SwiperInstance } from 'swiper'

const slideClass =
  '!box-border !shrink-0 !h-auto !w-[calc(100vw-48px)] sm:!w-[340px] md:!w-[420px] lg:!w-[420px]'

type Slide = {
  key: string
  node: ReactNode
}

type Props = {
  slides: Slide[]
}

/**
 * Общий горизонтальный swiper для «Выбор ⭐» / «Распаковка».
 * При росте slides (Ещё) — observer + update(), без remount key={length}.
 */
export default function StarStyleSwiper({ slides }: Props) {
  const swiperRef = useRef<SwiperInstance | null>(null)
  const slideCount = slides.length

  useEffect(() => {
    const sw = swiperRef.current
    if (!sw || sw.destroyed) return
    sw.update()
    sw.navigation?.update?.()
  }, [slideCount])

  if (slideCount === 0) return null

  return (
    <Swiper
      modules={[Navigation]}
      slidesPerView="auto"
      spaceBetween={12}
      grabCursor
      allowTouchMove
      simulateTouch
      threshold={5}
      touchRatio={1}
      preventClicks
      preventClicksPropagation
      observer
      observeParents
      observeSlideChildren
      navigation={{ enabled: true }}
      onSwiper={(sw) => {
        swiperRef.current = sw
      }}
      className="choice-swiper pb-10 rounded-[20px] [&_.swiper-button-prev]:hidden [&_.swiper-button-next]:hidden sm:[&_.swiper-button-prev]:flex sm:[&_.swiper-button-next]:flex"
      breakpoints={{
        640: { spaceBetween: 20 },
        768: { spaceBetween: 22 },
        1024: { spaceBetween: 24 },
      }}
    >
      {slides.map((slide) => (
        <SwiperSlide key={slide.key} className={slideClass}>
          <div className="h-auto w-full">{slide.node}</div>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
