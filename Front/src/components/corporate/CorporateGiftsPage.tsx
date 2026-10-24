'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const TELEGRAM_CORP = 'https://t.me/vspomni_corp'

type Slide = {
  src: string
  alt: string
  cta?: { href: string; label: string; external?: boolean }
}

const SLIDES: Slide[] = [
  {
    src: '/images/corporate-gifts/slide-01.webp',
    alt: 'ВСПОМНИ. — бренд стильных и вкусных ароматов из Петербурга',
  },
  {
    src: '/images/corporate-gifts/slide-02.webp',
    alt: 'Универсальный подарок, который понравится каждому',
  },
  {
    src: '/images/corporate-gifts/slide-03.webp',
    alt: 'Собственное производство в Санкт-Петербурге',
  },
  {
    src: '/images/corporate-gifts/slide-04.webp',
    alt: 'Наша философия',
  },
  {
    src: '/images/corporate-gifts/slide-05.webp',
    alt: 'Такой подарок никого не оставит равнодушным',
  },
  {
    src: '/images/corporate-gifts/slide-06.webp',
    alt: 'Виды брендирования: сроки и тиражи',
  },
  {
    src: '/images/corporate-gifts/slide-07.webp',
    alt: 'Корпоративный дизайн упаковки и носителей',
  },
  {
    src: '/images/corporate-gifts/slide-08.webp',
    alt: 'Остаётся в памяти вашего мероприятия',
  },
  {
    src: '/images/corporate-gifts/slide-09.webp',
    alt: 'Парфюм для интерьера',
  },
  {
    src: '/images/corporate-gifts/slide-10.webp',
    alt: 'Аромасаше',
  },
  {
    src: '/images/corporate-gifts/slide-11.webp',
    alt: 'Диффузоры',
  },
  {
    src: '/images/corporate-gifts/slide-12.webp',
    alt: 'Пакеты',
  },
  {
    src: '/images/corporate-gifts/slide-13.webp',
    alt: 'Наши уникальные ароматы',
  },
  {
    src: '/images/corporate-gifts/slide-14.webp',
    alt: 'Безопасный состав',
  },
  {
    src: '/images/corporate-gifts/slide-15.webp',
    alt: 'Нас выбирают звёзды шоу-бизнеса',
  },
  {
    src: '/images/corporate-gifts/slide-16.webp',
    alt: 'Контакты — поможем подобрать формат под задачу',
    cta: {
      href: TELEGRAM_CORP,
      label: 'Написать в Telegram',
      external: true,
    },
  },
  {
    src: '/images/corporate-gifts/slide-17.webp',
    alt: 'ВСПОМНИ. корпоративные подарки',
  },
]

function SlideBlock({ slide, index }: { slide: Slide; index: number }) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(index === 0)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <section
      ref={ref}
      className={`relative w-full transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
      aria-label={slide.alt}
    >
      <div className="relative aspect-[16/9] w-full bg-[#111]">
        <Image
          src={slide.src}
          alt={slide.alt}
          fill
          sizes="100vw"
          priority={index === 0}
          className="object-cover object-center"
          quality={90}
        />
      </div>
      {slide.cta ? (
        <Link
          href={slide.cta.href}
          target={slide.cta.external ? '_blank' : undefined}
          rel={slide.cta.external ? 'noopener noreferrer' : undefined}
          className="absolute inset-x-[6%] bottom-[8%] z-10 flex max-w-md flex-col gap-3 sm:inset-x-[8%] sm:bottom-[10%]"
          aria-label={slide.cta.label}
        >
          <span className="inline-flex w-fit items-center rounded-full border border-[#e5d1b8]/40 bg-black/35 px-5 py-2.5 text-[13px] font-semibold tracking-wide text-[#e5d1b8] backdrop-blur-md transition hover:border-[#e5d1b8]/70 hover:bg-black/50 sm:text-sm">
            {slide.cta.label}
          </span>
        </Link>
      ) : null}
    </section>
  )
}

export default function CorporateGiftsPage() {
  return (
    <div className="relative bg-[#0c0c0c] text-[#e8e0d4]">
      <h1 className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
        Корпоративные подарки ВСПОМНИ
      </h1>
      <div className="mx-auto flex w-full max-w-[1920px] flex-col">
        {SLIDES.map((slide, index) => (
          <SlideBlock key={slide.src} slide={slide} index={index} />
        ))}
      </div>
    </div>
  )
}
