'use client'

import { useEffect, useRef, useState } from 'react'
import StarStyleCard from './StarStyleCard'
import type { UnpackingReelItem } from '@/types/unpacking'

export interface UnpackingCardProps {
  item: UnpackingReelItem
}

const FALLBACK_IMAGE = '/images/choice-1.jpg'

/** Видимость слайда для autoplay (рядом 2–3 карточки — играют все с ratio > 0.4). */
const PLAY_VISIBILITY_RATIO = 0.4

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

function UnpackingVideoMedia({
  videoUrl,
  poster,
  label,
}: {
  videoUrl: string
  poster: string
  label: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (reducedMotion) {
      video.pause()
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      void video.play().catch(() => {})
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const visible =
          Boolean(entry?.isIntersecting) &&
          (entry?.intersectionRatio ?? 0) > PLAY_VISIBILITY_RATIO
        if (visible) {
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: [0, PLAY_VISIBILITY_RATIO, 0.75, 1] },
    )
    io.observe(video)
    return () => {
      io.disconnect()
      video.pause()
    }
  }, [videoUrl, reducedMotion])

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      src={videoUrl}
      poster={poster}
      muted
      playsInline
      loop
      preload={reducedMotion ? 'none' : 'metadata'}
      aria-label={label}
    />
  )
}

/** Карточка «Распаковка» — StarStyleCard + video media. */
export default function UnpackingCard({ item }: UnpackingCardProps) {
  const poster = item.posterUrl || item.thumbnail || FALLBACK_IMAGE

  return (
    <StarStyleCard
      item={{
        name: item.name,
        size: item.size,
        thumbnail: item.thumbnail || item.posterUrl || FALLBACK_IMAGE,
        price: item.price,
        oldPrice: item.oldPrice,
        star: item.captionName,
        date: item.captionDate,
        slug: item.slug,
        categorySlug: item.categorySlug,
        cartId: item.variantId || item.id,
        cartImage: item.posterUrl || item.thumbnail,
        variantId: item.variantId,
      }}
      media={
        <UnpackingVideoMedia
          videoUrl={item.videoUrl}
          poster={poster}
          label={item.name}
        />
      }
    />
  )
}
