'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  HERO_PLAQUE_HREF_DEFAULT,
  heroPlaqueTitleLines,
  type HeroPlaque,
} from '@vspomni/hero-types'

export type HeroSlideView = {
  id: string
  image: string
  slideHref: string
  plaque: HeroPlaque | null
}

export function HeroSlideLink({
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

/** Плашка без framer — CSS fade/slide (см. .hero-plaque-* в globals). */
export function HeroPlaqueOverlay({ plaque }: { plaque: HeroPlaque }) {
  const href = plaque.href.trim() || HERO_PLAQUE_HREF_DEFAULT
  const shellClass =
    'pointer-events-auto absolute bottom-3 left-3 z-20 flex max-h-[32%] w-[calc((100%-24px)*0.8)] cursor-pointer flex-row items-center gap-2.5 overflow-hidden rounded-[10px] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.18)] sm:max-h-none sm:gap-3 sm:rounded-[14px] sm:p-2 md:w-[40%] md:gap-4 md:rounded-2xl'
  const shellStyle = {
    boxSizing: 'border-box' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  }

  const titleLines = heroPlaqueTitleLines(plaque.title)
  const inner = (
    <div className="hero-plaque-in flex min-w-0 flex-1 flex-row items-center gap-2.5 sm:gap-3 md:gap-4">
      <div className="hero-plaque-thumb h-[51px] w-[51px] shrink-0 overflow-hidden rounded-[8px] sm:h-20 sm:w-20 sm:rounded-[10px] md:h-[98px] md:w-[98px] md:rounded-xl">
        <Image
          src={plaque.imageUrl}
          alt=""
          width={98}
          height={98}
          sizes="(max-width: 640px) 51px, (max-width: 768px) 80px, 98px"
          className="h-full w-full rounded-[8px] object-cover sm:rounded-[10px] md:rounded-xl"
        />
      </div>
      <div className="hero-plaque-text flex min-w-0 flex-1 flex-col justify-center overflow-hidden text-left text-black">
        <p className="mb-0.5 line-clamp-2 text-[10px] leading-tight font-semibold sm:mb-1.5 sm:line-clamp-none sm:text-[13px] md:text-base">
          {titleLines[0]}
          {titleLines[1] ? (
            <>
              <br className="hidden sm:block" />
              <span className="sm:hidden">, </span>
              {titleLines[1]}
            </>
          ) : null}
        </p>
        <p className="line-clamp-2 text-[10px] leading-snug text-black/80 sm:line-clamp-3 sm:text-[10px] md:text-xs">
          {plaque.subtitle}
        </p>
      </div>
    </div>
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

export function HeroStaticSlide({
  slide,
  className,
  imagePosition = 'center',
  priority = true,
}: {
  slide: HeroSlideView
  className: string
  imagePosition?: 'center' | 'top'
  priority?: boolean
}) {
  const imgClass =
    imagePosition === 'top'
      ? 'object-cover object-top'
      : 'object-cover object-center'
  const slideHref = slide.slideHref?.trim()
  const imageEl = (
    <Image
      src={slide.image}
      alt=""
      fill
      sizes="100vw"
      priority={priority}
      fetchPriority={priority ? 'high' : 'auto'}
      className={imgClass}
    />
  )

  return (
    <div className={className}>
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
    </div>
  )
}
