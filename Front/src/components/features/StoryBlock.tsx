'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoryGroup } from './StoryViewer'
import StoryCirclePreview from './StoryCirclePreview'
import { getAllStories, StoryNode } from '@/graphql/queries/stories.service'

const StoryViewer = dynamic(() => import('./StoryViewer'), {
  ssr: false,
  loading: () => null,
})

function getCirclePreviewSources(story: StoryNode) {
  const imageUrl =
    story.coverUrl ||
    story.image ||
    story.items.find((item) => item.type === 'image')?.url ||
    null

  const videoUrl =
    !imageUrl
      ? story.items.find((item) => item.type === 'video')?.url || null
      : null

  return { imageUrl, videoUrl }
}

function StoryCircle({
  group,
  preview,
  onOpen,
}: {
  group: StoryGroup
  preview: { imageUrl: string | null; videoUrl: string | null } | null
  onOpen: () => void
}) {
  return (
    <div className="flex w-[70px] shrink-0 flex-col items-center text-center sm:w-20 md:w-[88px] lg:w-24">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex h-[70px] w-[70px] cursor-pointer items-center justify-center rounded-full border border-black transition-all duration-300 hover:border-black/60 sm:h-20 sm:w-20 md:h-[88px] md:w-[88px] lg:h-24 lg:w-24"
      >
        <div className="h-[62px] w-[62px] overflow-hidden rounded-full bg-white sm:h-[72px] sm:w-[72px] md:h-[79px] md:w-[79px] lg:h-[87px] lg:w-[87px]">
          <StoryCirclePreview
            imageUrl={preview?.imageUrl}
            videoUrl={preview?.videoUrl}
            alt={group.title}
          />
        </div>
      </button>
      <span className="mt-1.5 line-clamp-2 max-w-full break-words text-[11px] font-medium leading-[14px] text-neutral-700 hyphens-auto sm:mt-2 sm:text-[12px] sm:leading-[15px] md:text-[13px] md:leading-[16px]">
        {group.title}
      </span>
    </div>
  )
}

function StoryScrollArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const isPrev = direction === 'prev'
  return (
    <button
      type="button"
      aria-label={isPrev ? 'Прокрутить сторис влево' : 'Прокрутить сторис вправо'}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-[34px] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition hover:scale-105 hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)] disabled:pointer-events-none disabled:opacity-0 sm:top-10 sm:flex md:top-[44px] lg:top-12 ${
        isPrev ? 'left-0' : 'right-0'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 text-black"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {isPrev ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 6l6 6-6 6" />
        )}
      </svg>
    </button>
  )
}

type Props = {
  /** Сторис с RSC — без client waterfall. */
  initialStories?: StoryNode[]
}

export default function StoryBlock({ initialStories }: Props) {
  const fromServer = initialStories !== undefined
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null)
  const [initialStoryIndex, setInitialStoryIndex] = useState(0)
  const [stories, setStories] = useState<StoryNode[]>(initialStories ?? [])
  const [loading, setLoading] = useState(!fromServer)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const syncScrollArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      setCanScrollPrev(false)
      setCanScrollNext(false)
      return
    }
    const max = el.scrollWidth - el.clientWidth
    const overflow = max > 2
    setCanScrollPrev(overflow && el.scrollLeft > 2)
    setCanScrollNext(overflow && el.scrollLeft < max - 2)
  }, [])

  useEffect(() => {
    if (fromServer) {
      setStories(initialStories ?? [])
      setLoading(false)
      return
    }
    let cancelled = false
    const fetchStories = async () => {
      try {
        const data = await getAllStories()
        if (!cancelled) setStories(data)
      } catch (error) {
        console.error('Failed to fetch stories:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchStories()
    return () => {
      cancelled = true
    }
  }, [fromServer, initialStories])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || loading) return
    syncScrollArrows()
    el.addEventListener('scroll', syncScrollArrows, { passive: true })
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncScrollArrows())
        : null
    ro?.observe(el)
    window.addEventListener('resize', syncScrollArrows)
    return () => {
      el.removeEventListener('scroll', syncScrollArrows)
      ro?.disconnect()
      window.removeEventListener('resize', syncScrollArrows)
    }
  }, [loading, stories, syncScrollArrows])

  const scrollByPage = (dir: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const delta = Math.max(160, Math.round(el.clientWidth * 0.7)) * dir
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <section className="mt-4 mb-4 px-0 sm:mt-5 sm:mb-5 sm:px-6 md:mt-6 md:mb-6 md:px-8 lg:mt-8">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full justify-center gap-3 px-0 pb-1 sm:gap-[14px] md:gap-4 lg:gap-[18px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex shrink-0 flex-col items-center gap-2">
                <div className="h-[70px] w-[70px] animate-pulse rounded-full bg-neutral-200 sm:h-20 sm:w-20 md:h-[88px] md:w-[88px] lg:h-24 lg:w-24" />
                <div className="h-3 w-[60px] animate-pulse rounded-full bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (stories.length === 0) {
    return null
  }

  const storyGroups: StoryGroup[] = stories
    .filter(
      (story) => story.isPublished && story.items && story.items.length > 0,
    )
    .sort((a, b) => a.order - b.order)
    .map((story) => ({
      id: story.id,
      title: story.title,
      stories: story.items
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ url: item.url, type: item.type })),
    }))

  const handleOpenGroup = (index: number) => {
    setActiveGroupIndex(index)
    setInitialStoryIndex(0)
  }

  const handleGoToGroup = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= storyGroups.length) {
      setActiveGroupIndex(null)
      return
    }
    setActiveGroupIndex(nextIndex)
    setInitialStoryIndex(
      nextIndex > (activeGroupIndex ?? 0)
        ? 0
        : storyGroups[nextIndex].stories.length - 1,
    )
  }

  const renderCircles = (keyPrefix: string) =>
    storyGroups.map((group, index) => {
      const story = stories.find((s) => s.id === group.id)
      const preview = story ? getCirclePreviewSources(story) : null
      return (
        <StoryCircle
          key={`${keyPrefix}-${group.id}`}
          group={group}
          preview={preview}
          onOpen={() => handleOpenGroup(index)}
        />
      )
    })

  const showDesktopArrows = canScrollPrev || canScrollNext

  return (
    <>
      <section className="mt-4 mb-4 px-0 sm:mt-5 sm:mb-5 sm:px-6 md:mt-6 md:mb-6 md:px-8 lg:mt-8">
        <div className="relative">
          {showDesktopArrows ? (
            <>
              <StoryScrollArrow
                direction="prev"
                disabled={!canScrollPrev}
                onClick={() => scrollByPage(-1)}
              />
              <StoryScrollArrow
                direction="next"
                disabled={!canScrollNext}
                onClick={() => scrollByPage(1)}
              />
            </>
          ) : null}
          <div
            ref={scrollerRef}
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max min-w-full justify-center gap-3 px-0 pb-1 sm:gap-[14px] md:gap-4 lg:gap-[18px]">
              {renderCircles('all')}
            </div>
          </div>
        </div>
      </section>

      {activeGroupIndex !== null && (
        <StoryViewer
          groups={storyGroups}
          currentGroupIndex={activeGroupIndex}
          initialStoryIndex={initialStoryIndex}
          onClose={() => setActiveGroupIndex(null)}
          onGoToGroup={handleGoToGroup}
        />
      )}
    </>
  )
}
