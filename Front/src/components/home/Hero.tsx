'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import 'swiper/css/effect-fade'

import { motion } from 'framer-motion'
import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import {
  HERO_PLAQUE_HREF_DEFAULT,
  HERO_SLIDE_HREF_DEFAULT,
  heroPlaqueTitleLines,
  type HeroPlaque,
  type HeroSlide,
} from '@vspomni/hero-types'
import { useMobile } from '@/lib/hooks'

type HeroSlideView = {
  id: string
  image: string
  slideHref: string
  plaque: HeroPlaque | null
}

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

function HeroPlaqueOverlay({ plaque }: { plaque: HeroPlaque }) {
  const href = plaque.href.trim() || HERO_PLAQUE_HREF_DEFAULT
  const shellClass =
    'pointer-events-auto absolute bottom-3 left-3 z-20 flex max-h-[40%] w-[calc(100%-24px)] cursor-pointer flex-row items-center gap-3 overflow-hidden rounded-[12px] p-2 shadow-[0_8px_28px_rgba(0,0,0,0.18)] sm:max-h-none sm:gap-4 sm:rounded-2xl sm:p-2.5 md:w-1/2 md:gap-5 md:rounded-[20px]'
  const shellStyle = {
    boxSizing: 'border-box' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  }

  const titleLines = heroPlaqueTitleLines(plaque.title)
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      className="flex min-w-0 flex-1 flex-row items-center gap-3 sm:gap-4 md:gap-5"
    >
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] sm:h-[100px] sm:w-[100px] sm:rounded-[12px] md:h-[122px] md:w-[122px] md:rounded-[14px]"
      >
        <img
          src={plaque.imageUrl}
          alt=""
          className="h-full w-full rounded-[10px] object-cover sm:rounded-[12px] md:rounded-[14px]"
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 15 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden text-left text-black"
      >
        <p className="mb-0.5 line-clamp-2 text-[13px] leading-tight font-semibold sm:mb-2 sm:line-clamp-none sm:text-[16px] md:text-[20px]">
          {titleLines[0]}
          {titleLines[1] ? (
            <>
              <br className="hidden sm:block" />
              <span className="sm:hidden">, </span>
              {titleLines[1]}
            </>
          ) : null}
        </p>
        <p className="line-clamp-2 text-[12px] leading-snug text-black/80 sm:line-clamp-3 sm:text-[13px] md:text-[15px]">
          {plaque.subtitle}
        </p>
      </motion.div>
    </motion.div>
  )

  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={shellClass}
        style={shellStyle}
        aria-label={`${plaque.title}: перейти`}
      >
        {inner}
      </a>
    )
  }

  return (
    <Link
      href={href}
      className={shellClass}
      style={shellStyle}
      aria-label={`${plaque.title}: перейти`}
    >
      {inner}
    </Link>
  )
}

function HeroSlideLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string
  className?: string
  ariaLabel: string
  children: ReactNode
}) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}

function HeroSwiper({
  slides,
  paginationEnabled,
  className,
  imagePosition = 'center',
}: {
  slides: HeroSlideView[]
  paginationEnabled: boolean
  className: string
  imagePosition?: 'center' | 'top'
}) {
  const imgClass =
    imagePosition === 'top'
      ? 'absolute inset-0 h-full w-full object-cover object-top'
      : 'absolute inset-0 h-full w-full object-cover object-center'
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
      simulateTouch={true}
      threshold={5}
      touchRatio={1}
      preventClicks={false}
      preventClicksPropagation={false}
      className={className}
    >
      {slides.map((slide) => {
        const slideHref = slide.slideHref?.trim()
        const imageEl = (
          <img
            src={slide.image}
            alt=""
            className={imgClass}
            style={imagePosition === 'top' ? { objectPosition: 'top' } : undefined}
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

  return (
    <section className="relative w-full overflow-hidden px-0">
      <HeroSwiper
        key={isMdUp ? 'desk' : 'mob'}
        slides={slides}
        paginationEnabled={slides.length > 1}
        className={SWIPER_CLASS}
        imagePosition={isMdUp ? 'center' : 'top'}
      />
    </section>
  )
}
