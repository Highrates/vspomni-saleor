'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from './Hero.module.css';

export type HeroSlideInput = {
  id: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
};

const DEFAULT_IMAGE = '/images/home/hero/cover.webp';

export function Hero({
  slides,
  imageUrl = DEFAULT_IMAGE,
  mobileImageUrl,
}: {
  /** Слайды из настроек; если пусто — fallback на imageUrl */
  slides?: HeroSlideInput[];
  imageUrl?: string;
  /** Опциональный портретный/лёгкий кроп для ≤768px */
  mobileImageUrl?: string;
}) {
  const normalized =
    slides && slides.length > 0
      ? slides.map((s) => ({
          id: s.id,
          imageUrl: s.imageUrl,
          mobileImageUrl: s.mobileImageUrl ?? undefined,
        }))
      : [
          {
            id: 'fallback',
            imageUrl,
            mobileImageUrl,
          },
        ];

  const [index, setIndex] = useState(0);
  const hasMultiple = normalized.length > 1;

  useEffect(() => {
    if (!hasMultiple) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % normalized.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasMultiple, normalized.length]);

  const current = normalized[index] ?? normalized[0]!;
  const desktopSrc = current.imageUrl;
  const mobileSrc = current.mobileImageUrl ?? current.imageUrl;
  const hasMobileSrc = Boolean(
    current.mobileImageUrl && current.mobileImageUrl !== current.imageUrl,
  );
  const remoteDesktop = /^https?:\/\//i.test(desktopSrc);
  const remoteMobile = /^https?:\/\//i.test(mobileSrc);

  return (
    <section id="hero-section" className={styles.section} aria-label="Главный экран">
      <div className={styles.heroBg} key={current.id}>
        <Image
          src={desktopSrc}
          alt="Jcos — декоративная косметика"
          fill
          className={[styles.heroImage, hasMobileSrc ? styles.heroImageDesktop : '']
            .filter(Boolean)
            .join(' ')}
          sizes="(max-width: 768px) 100vw, 100vw"
          quality={78}
          priority={index === 0}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          unoptimized={remoteDesktop}
        />
        {hasMobileSrc ? (
          <Image
            src={mobileSrc}
            alt="Jcos — декоративная косметика"
            fill
            className={[styles.heroImage, styles.heroImageMobile].join(' ')}
            sizes="100vw"
            quality={72}
            priority={index === 0}
            unoptimized={remoteMobile}
          />
        ) : null}
      </div>
      {hasMultiple ? (
        <div className={styles.dots} role="tablist" aria-label="Слайды">
          {normalized.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
