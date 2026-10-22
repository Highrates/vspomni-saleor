'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Сюжет Первого канала («Доброе утро»).
 * Desktop: видео слева, текст справа (высота = «Скоро свечи» + 25%).
 * Mobile: колонка — видео сверху (с постером), текст снизу.
 *
 * Медиа: WebM VP9 ~12MB + MP4 fallback ~29MB.
 * `<video>` монтируется по IntersectionObserver (preload=none до play).
 */
const VIDEO_WEBM = '/videos/1-ch-web.webm'
const VIDEO_MP4 = '/videos/1-ch-web.mp4'
/** ~68KB WebP (было 1.8MB PNG). */
const VIDEO_POSTER = '/images/video-cover.webp'

const LINES = [
  'Первый канал увидел Вспомни. в социальных сетях 🤩',
  'Попросили экскурсию к нам на производство и снять сюжет',
  'Спустя несколько недель вышел Вспомни. в программе «Доброе утро» 🥹',
] as const

const LINE_CLASS =
  'm-0 font-semibold text-brand text-[12px] sm:text-base lg:text-lg leading-[1.4]'

export default function ChannelOneSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playAfterMount = useRef(false)
  const [mountVideo, setMountVideo] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || mountVideo) return
    if (typeof IntersectionObserver === 'undefined') {
      setMountVideo(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMountVideo(true)
          io.disconnect()
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mountVideo])

  const playVideo = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      video.muted = false
      await video.play()
      setPlaying(true)
    } catch {
      try {
        video.muted = true
        await video.play()
        setPlaying(true)
      } catch (err) {
        console.error('ChannelOne video play failed', err)
      }
    }
  }

  useEffect(() => {
    if (!mountVideo || !playAfterMount.current) return
    playAfterMount.current = false
    void playVideo()
  }, [mountVideo])

  const handlePlayClick = () => {
    if (!mountVideo) {
      playAfterMount.current = true
      setMountVideo(true)
      return
    }
    void playVideo()
  }

  return (
    <section
      ref={sectionRef}
      className="w-full px-0 mt-4 sm:mt-6 md:mt-8 lg:mt-10 mb-4 sm:mb-6 md:mb-8 lg:mb-10"
    >
      <style>{`
        .channel-one-card {
          background: #f5f5f5;
        }
        @media (min-width: 640px) {
          .channel-one-card {
            height: 300px !important;
          }
        }
        @media (min-width: 768px) {
          .channel-one-card {
            height: 375px !important;
          }
        }
        @media (min-width: 1024px) {
          .channel-one-card {
            height: 425px !important;
          }
        }
      `}</style>

      <div className="channel-one-card flex w-full flex-col overflow-hidden rounded-[16px] sm:flex-row">
        <div className="relative w-full shrink-0 overflow-hidden bg-black sm:h-full sm:w-1/2">
          {mountVideo ? (
            <video
              ref={videoRef}
              className="block w-full aspect-video object-cover sm:absolute sm:inset-0 sm:aspect-auto sm:h-full sm:w-full"
              poster={VIDEO_POSTER}
              controls={playing}
              playsInline
              preload="none"
              controlsList="nodownload"
              aria-label="Сюжет о Вспомни на Первом канале, программа Доброе утро"
              onPlay={() => setPlaying(true)}
              onPause={() => {
                const v = videoRef.current
                if (v && v.currentTime > 0 && !v.ended) setPlaying(true)
              }}
            >
              <source src={VIDEO_WEBM} type="video/webm" />
              <source src={VIDEO_MP4} type="video/mp4" />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={VIDEO_POSTER}
              alt=""
              className="block w-full aspect-video object-cover sm:absolute sm:inset-0 sm:aspect-auto sm:h-full sm:w-full"
              decoding="async"
              loading="lazy"
            />
          )}

          {!playing ? (
            <button
              type="button"
              onClick={handlePlayClick}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 touch-manipulation"
              aria-label="Смотреть сюжет"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-md sm:h-16 sm:w-16">
                <svg
                  viewBox="0 0 24 24"
                  className="ml-0.5 h-7 w-7 text-black sm:h-8 sm:w-8"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 5.14v13.72L19 12 8 5.14z" />
                </svg>
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 w-full flex-col justify-center gap-3 bg-[#F5F5F5] px-4 py-5 sm:h-full sm:w-1/2 sm:gap-3 sm:px-6 sm:py-0 md:px-8 lg:gap-4 lg:px-10">
          <p className="m-0 font-semibold uppercase tracking-[0.12em] text-brand/50 text-[10px] sm:text-xs">
            Первый канал · Доброе утро
          </p>
          <div className="flex flex-col gap-2.5 sm:gap-2 md:gap-3">
            {LINES.map((line) => (
              <p key={line} className={LINE_CLASS}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
