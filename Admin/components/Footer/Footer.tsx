'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCatalogNav } from '@/components/CatalogNav/CatalogNavContext';
import { LogoPaths } from '@/components/SiteLoader/LogoPaths';
import styles from './Footer.module.css';

const infoLinks = [
  { href: '/about', label: 'О нас' },
  { href: '/blog', label: 'Новости и статьи' },
  { href: '/certificates', label: 'Подарочные сертификаты' },
  { href: '/delivery', label: 'Доставка и оплата' },
  { href: '/returns', label: 'Обмен и возврат' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contacts', label: 'Контакты' },
];

const legalLinks = [
  { href: '/privacy', label: 'Политика конфиденциальности' },
  { href: '/terms', label: 'Оферта' },
  { href: '/cookies', label: 'Cookies' },
];

const TELEGRAM_HREF = (process.env.NEXT_PUBLIC_TELEGRAM_URL ?? '').trim();
const CLUB_HREF = '/register';

const FOOTER_RIGHT_HOME = '#EFDECD';
const FOOTER_RIGHT_CATALOG = '#FFC0CB';
const FOOTER_RIGHT_PRODUCT = '#DBC5EE';

const FOOTER_RIGHT_OTHER = [
  '#E8F0E3',
  '#F5E6D3',
  '#E3EEF5',
  '#F0E8F5',
  '#E8F5F0',
  '#F5F0E3',
  '#EDE4DC',
  '#E4EDE8',
] as const;

function hashPathname(pathname: string): number {
  let h = 0;
  for (let i = 0; i < pathname.length; i++) {
    h = (h * 31 + pathname.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function footerRightBackground(pathname: string): string {
  if (pathname === '/' || pathname === '') return FOOTER_RIGHT_HOME;
  if (pathname.startsWith('/product/')) return FOOTER_RIGHT_PRODUCT;
  if (pathname === '/catalog' || pathname.startsWith('/catalog/')) {
    return FOOTER_RIGHT_CATALOG;
  }
  const idx = hashPathname(pathname) % FOOTER_RIGHT_OTHER.length;
  return FOOTER_RIGHT_OTHER[idx]!;
}

export function Footer() {
  const pathname = usePathname() ?? '';
  const logoRef = useRef<HTMLDivElement>(null);
  const rightBg = useMemo(() => footerRightBackground(pathname), [pathname]);
  const { categories, tags } = useCatalogNav();

  const catalogLinks = useMemo(() => {
    const items = categories.map((c) => ({
      href: `/catalog/${encodeURIComponent(c.slug)}`,
      label: c.name,
    }));
    return items.length ? items : [{ href: '/catalog', label: 'Каталог' }];
  }, [categories]);

  const zoneLinks = useMemo(
    () =>
      tags.map((t) => ({
        href: `/catalog?tag=${encodeURIComponent(t.slug)}`,
        label: t.name,
      })),
    [tags],
  );

  /* Скролл: начало ведёт, конец догоняет (как на Win-Win). */
  useEffect(() => {
    const root = logoRef.current;
    if (!root) return;
    const letters = Array.from(root.querySelectorAll<HTMLElement>('.logo-wave__letter'));
    if (!letters.length) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const n = letters.length;
    const lag = new Array<number>(n).fill(0);
    const maxLag = 36;
    let lastScroll = window.scrollY;
    let raf = 0;

    const paint = () => {
      let alive = false;
      lag[0]! *= 0.86;
      if (Math.abs(lag[0]!) > 0.08) alive = true;

      for (let i = 1; i < n; i++) {
        lag[i]! += (lag[i - 1]! - lag[i]!) * 0.28;
        lag[i]! *= 0.97;
        if (Math.abs(lag[i]!) > 0.08) alive = true;
      }

      for (let i = 0; i < n; i++) {
        letters[i]!.style.transform = `translate3d(0, ${lag[i]}px, 0)`;
      }

      if (alive) raf = requestAnimationFrame(paint);
      else raf = 0;
    };

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScroll;
      lastScroll = y;
      if (dy === 0) return;

      lag[0] = Math.max(-maxLag, Math.min(maxLag, lag[0]! + dy * 0.55));
      if (!raf) raf = requestAnimationFrame(paint);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      for (const el of letters) el.style.transform = '';
    };
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.left}>
          <nav className={styles.columns} aria-label="Футер">
            <div className={styles.column}>
              <span className={styles.columnTitle}>Каталог</span>
              <div className={styles.columnLinks}>
                {catalogLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.column}>
              <span className={styles.columnTitle}>Области применения</span>
              <div className={styles.columnLinks}>
                {zoneLinks.length > 0 ? (
                  zoneLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                      {link.label}
                    </Link>
                  ))
                ) : (
                  <Link href="/catalog">Все товары</Link>
                )}
              </div>
            </div>

            <div className={styles.column}>
              <span className={styles.columnTitle}>Инфо</span>
              <div className={styles.columnLinks}>
                {infoLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div className={styles.leftBottom}>
            <aside className={styles.partnerCta} aria-label="Клуб Jcos">
              <p className={styles.partnerCtaTitle}>Клуб Jcos</p>
              <p className={styles.partnerCtaText}>
                Новинки, уход и спецпредложения —
                <br />
                присоединяйтесь к{'\u00A0'}клубу и узнавайте первыми
                о{'\u00A0'}коллекциях и{'\u00A0'}акциях.
              </p>
              <Link href={CLUB_HREF} className={styles.partnerCtaLink}>
                Войти в клуб
              </Link>
            </aside>

            <div className={styles.leftBottomMeta}>
              <div className={styles.legalLinks}>
                {legalLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
              <span className={styles.copyright}>Jcos. Все права защищены.</span>
            </div>
          </div>
        </div>

        <div className={styles.right} style={{ background: rightBg }}>
          <div className={styles.rightTop}>
            <Link href="/login?from=/" className={styles.rightLink}>
              Вход
            </Link>
            {TELEGRAM_HREF ? (
              <a
                href={TELEGRAM_HREF}
                className={styles.rightLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Телеграм
              </a>
            ) : (
              <Link href="/contacts" className={styles.rightLink}>
                Телеграм
              </Link>
            )}
          </div>

          <div className={styles.rightLogoSlot}>
            <div ref={logoRef} className={styles.rightLogo} aria-label="Jcos">
              <LogoPaths className={styles.rightLogoMark} />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
