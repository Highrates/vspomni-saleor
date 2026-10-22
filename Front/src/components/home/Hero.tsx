'use client'

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  HERO_SLIDE_HREF_DEFAULT,
  type HeroSlide,
} from '@vspomni/hero-types'
import { useMobile } from '@/lib/hooks'
import {
  HeroStaticSlide,
  type HeroSlideView,
} from './HeroSlideShared'

/** Empty-state только при пустом API — не источник плашек. */
const EMPTY_STATE_SLIDES: HeroSlideView[] = [
  {
    id: 'empty-1',
    image: '/images/hero-left-1.jpg',
    slideHref: HERO_SLIDE_HREF_DEFAULT,
    plaque: null,
  },
]

function toViews(slides: HeroSlide[], preferDesktop: boolean): HeroSlideView[] {
  if (slides.length === 0) return EMPTY_STATE_SLIDES
  return slides.map((s) => ({
    id: s.id,
    image: preferDesktop ? s.imageUrl : s.mobileImageUrl,
    slideHref: s.href || HERO_SLIDE_HREF_DEFAULT,
    plaque: s.plaque,
  }))
}

const SWIPER_CLASS = 'hero-swiper w-full h-[70vh] sm:h-[80vh] md:h-[85vh] lg:h-[90vh]'

type CarouselProps = {
  slides: HeroSlideView[]
  paginationEnabled: boolean
  className: string
  imagePosition?: 'center' | 'top'
}

type Props = {
  /** Resolved-слайды с RSC (один GET /settings/hero). */
  initialSlides: HeroSlide[]
}

export default function Hero({ initialSlides }: Props) {
  const isMdUp = !useMobile(768)
  const slides = useMemo(
    () => toViews(initialSlides, isMdUp),
    [initialSlides, isMdUp],
  )
  const multi = slides.length > 1
  const [Carousel, setCarousel] = useState<ComponentType<CarouselProps> | null>(
    null,
  )

  useEffect(() => {
    if (!multi) return
    let cancelled = false
    import('./HeroCarousel')
      .then((m) => {
        if (!cancelled) setCarousel(() => m.default)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [multi])

  const imagePosition = isMdUp ? 'center' : 'top'

  return (
    <section className="relative w-full overflow-hidden px-0">
      {Carousel && multi ? (
        <Carousel
          key={isMdUp ? 'desk' : 'mob'}
          slides={slides}
          paginationEnabled
          className={SWIPER_CLASS}
          imagePosition={imagePosition}
        />
      ) : (
        <HeroStaticSlide
          key={isMdUp ? 'desk-static' : 'mob-static'}
          slide={slides[0]}
          className={SWIPER_CLASS}
          imagePosition={imagePosition}
          priority
        />
      )}
    </section>
  )
}
