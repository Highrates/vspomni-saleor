'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoPaths } from '@/components/SiteLoader/LogoPaths';
import {
  MENU_COVERED_EVENT,
  TransitionLink,
} from '@/components/SiteTransition';
import { useCart } from '@/lib/cart/CartContext';
import { useBuyerAuth } from '@/lib/BuyerAuthProvider';
import { useCatalogNav } from '@/components/CatalogNav/CatalogNavContext';
import {
  animateLogoWaveIn,
  logoWaveDistance,
  prepareLogoWaveIn,
  preloadLogoWaveAnime,
  resetLogoWaveVisible,
} from '@/components/SiteLoader/logoWave';
import { trapFocusKeydown } from '@/lib/focusTrap';
import styles from './Header.module.css';
import { HeaderSearchPanel } from './HeaderSearchPanel';

const MENU_SECTIONS = [
  { id: 'categories', href: '/catalog', label: 'Каталог' },
  { id: 'zones', href: '/catalog', label: 'Области применения' },
] as const;

const MOBILE_INFO_LINKS = [
  { href: '/about', label: 'О нас' },
  { href: '/blog', label: 'Новости и статьи' },
  { href: '/certificates', label: 'Подарочные сертификаты' },
  { href: '/delivery', label: 'Доставка и оплата' },
  { href: '/returns', label: 'Обмен и возврат' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contacts', label: 'Контакты' },
] as const;

const MOBILE_MENU_PANEL_ID = 'mobile-menu-panel';
const MOBILE_MENU_CATALOG_ID = 'mobile-menu-catalog-sub';
const MOBILE_MENU_ZONES_ID = 'mobile-menu-zones-sub';
const BODY_MOBILE_MENU_OPEN = 'header-mobile-menu-open';

function motionMs(full: number) {
  if (typeof window === 'undefined') return full;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : full;
}

type NavLink = { href: string; label: string; coverImageUrl?: string | null };

const HERO_SECTION_ID = 'hero-section';
const PAST_THRESHOLD = 80;
const OVER_MINIMAL_THRESHOLD = 80;

type HeaderVariant = 'minimal' | 'main';

function MenuChevron({ open }: { open: boolean }) {
  return (
    <figure className={styles.menuChevron} aria-hidden data-open={open || undefined}>
      <svg xmlns="http://www.w3.org/2000/svg" width="9" height="5" viewBox="0 0 9 5" fill="none">
        <path d="M0 0L4.5 5L9 0" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </figure>
  );
}

/** Инлайн — без кэша старого /icons/shopping-bag.svg */
function SearchIcon() {
  return (
    <svg
      className={styles.searchIcon}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9.58329 17.5C13.9555 17.5 17.5 13.9556 17.5 9.58333C17.5 5.21108 13.9555 1.66667 9.58329 1.66667C5.21104 1.66667 1.66663 5.21108 1.66663 9.58333C1.66663 13.9556 5.21104 17.5 9.58329 17.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.3333 18.3333L16.6666 16.6667"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      className={styles.bagIcon}
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7.70002 5.95834H14.3C17.4167 5.95834 17.7284 7.41583 17.9392 9.19417L18.7642 16.0692C19.03 18.3242 18.3334 20.1667 15.125 20.1667H6.88419C3.66669 20.1667 2.97002 18.3242 3.24502 16.0692L4.07003 9.19417C4.2717 7.41583 4.58336 5.95834 7.70002 5.95834Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.33325 7.33334V4.125C7.33325 2.75 8.24992 1.83334 9.62492 1.83334H12.3749C13.7499 1.83334 14.6666 2.75 14.6666 4.125V7.33334"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.7091 15.6108H7.33325"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useScrolledPastHero(isLanding: boolean, pathname: string) {
  const [past, setPast] = useState(false);
  const pastRef = useRef(false);

  useEffect(() => {
    if (!isLanding) {
      setPast(true);
      pastRef.current = true;
      return;
    }
    setPast(false);
    pastRef.current = false;

    let scrollCleanup: (() => void) | null = null;
    let heroObserver: MutationObserver | null = null;

    const attachScrollTracking = (hero: HTMLElement) => {
      let scrollRafId = 0;

      const update = () => {
        const bottom = hero.getBoundingClientRect().bottom;
        if (pastRef.current) {
          if (bottom > OVER_MINIMAL_THRESHOLD) {
            pastRef.current = false;
            setPast(false);
          }
        } else if (bottom < -PAST_THRESHOLD) {
          pastRef.current = true;
          setPast(true);
        }
      };

      const onScroll = () => {
        cancelAnimationFrame(scrollRafId);
        scrollRafId = requestAnimationFrame(update);
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      update();

      scrollCleanup = () => {
        window.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(scrollRafId);
      };
    };

    const tryAttach = () => {
      const hero = document.getElementById(HERO_SECTION_ID);
      if (hero) {
        heroObserver?.disconnect();
        heroObserver = null;
        attachScrollTracking(hero);
        return true;
      }
      return false;
    };

    if (!tryAttach()) {
      heroObserver = new MutationObserver(() => {
        if (tryAttach()) {
          heroObserver?.disconnect();
          heroObserver = null;
        }
      });
      heroObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      scrollCleanup?.();
      heroObserver?.disconnect();
    };
  }, [isLanding, pathname]);

  return past;
}

export function Header() {
  const pathname = usePathname() ?? '';
  const isCheckout =
    pathname === '/checkout' || pathname.startsWith('/checkout/');
  const isAccount =
    pathname === '/account' || pathname.startsWith('/account/');
  const isCatalogPath =
    pathname === '/catalog' || pathname.startsWith('/catalog/');
  const isLanding =
    !isCheckout &&
    (pathname === '/' || isCatalogPath || isAccount);
  const isLightHero = isCatalogPath || isAccount;
  const hasScrolledPastHero = useScrolledPastHero(isLanding, pathname);
  const { openCart, itemCount, hydrated, closeCart } = useCart();
  const { authenticated: buyerAuthed } = useBuyerAuth();

  useEffect(() => {
    if (isCheckout) closeCart();
  }, [isCheckout, closeCart]);

  const { categories: navCategories, tags: navTags } = useCatalogNav();
  const catalogLinks = useMemo<NavLink[]>(() => {
    const items = navCategories.map((c) => ({
      href: `/catalog/${encodeURIComponent(c.slug)}`,
      label: c.name,
    }));
    return items.length ? items : [{ href: '/catalog', label: 'Каталог' }];
  }, [navCategories]);
  const zoneLinks = useMemo<NavLink[]>(
    () =>
      navTags.map((t) => ({
        href: `/catalog?tag=${encodeURIComponent(t.slug)}`,
        label: t.name,
        coverImageUrl: t.coverImageUrl ?? null,
      })),
    [navTags],
  );

  const variant: HeaderVariant = isCheckout
    ? 'main'
    : !isLanding
      ? 'main'
      : hasScrolledPastHero
        ? 'main'
        : 'minimal';

  const isMainOverlayOnHome = isLanding && variant === 'main';

  const [superMenuOpen, setSuperMenuOpen] = useState(false);
  const [superMenuClosing, setSuperMenuClosing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);
  const [mobileMenuContentRevealed, setMobileMenuContentRevealed] = useState(false);
  const [mobileMenuCatalogOpen, setMobileMenuCatalogOpen] = useState(false);
  const [mobileMenuZonesOpen, setMobileMenuZonesOpen] = useState(false);
  const [section, setSection] = useState<(typeof MENU_SECTIONS)[number]['id'] | null>(null);
  const [logoWaveReady, setLogoWaveReady] = useState(false);
  const [logoFading, setLogoFading] = useState(false);
  const [mainOverlayVisible, setMainOverlayVisible] = useState(false);
  const [logoWaveSeq, setLogoWaveSeq] = useState(0);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null);
  const restoreSearchFocusRef = useRef(false);
  const logoWaveRef = useRef<HTMLSpanElement>(null);
  const logoRevealedRef = useRef(false);
  const prevVariantRef = useRef(variant);
  const closeSuperMenuRef = useRef<() => void>(() => {});
  const closeSearchRef = useRef<(opts?: { restoreFocus?: boolean }) => void>(() => {});
  const closeMobileMenuRef = useRef<() => void>(() => {});
  const dismissMobileMenuInstantRef = useRef<() => void>(() => {});

  const closeSuperMenu = useCallback(() => {
    if (!superMenuOpen && !superMenuClosing) return;
    setSuperMenuClosing(true);
    setSuperMenuOpen(false);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setSuperMenuClosing(false);
      setSection(null);
      closeTimeoutRef.current = null;
    }, motionMs(560));
  }, [superMenuOpen, superMenuClosing]);
  closeSuperMenuRef.current = closeSuperMenu;

  const dismissMobileMenuInstant = useCallback(() => {
    if (mobileMenuCloseTimeoutRef.current) {
      clearTimeout(mobileMenuCloseTimeoutRef.current);
      mobileMenuCloseTimeoutRef.current = null;
    }
    setMobileMenuOpen(false);
    setMobileMenuClosing(false);
    setMobileMenuContentRevealed(false);
    setMobileMenuCatalogOpen(false);
    setMobileMenuZonesOpen(false);
  }, []);
  dismissMobileMenuInstantRef.current = dismissMobileMenuInstant;

  const closeMobileMenu = useCallback(() => {
    if (!mobileMenuOpen || mobileMenuClosing) return;
    setMobileMenuContentRevealed(false);
    setMobileMenuClosing(true);
    if (mobileMenuCloseTimeoutRef.current) clearTimeout(mobileMenuCloseTimeoutRef.current);
    mobileMenuCloseTimeoutRef.current = setTimeout(() => {
      mobileMenuCloseTimeoutRef.current = null;
      setMobileMenuOpen(false);
      setMobileMenuClosing(false);
      setMobileMenuCatalogOpen(false);
      setMobileMenuZonesOpen(false);
    }, motionMs(280));
  }, [mobileMenuOpen, mobileMenuClosing]);
  closeMobileMenuRef.current = closeMobileMenu;

  const toggleMobileMenu = useCallback(() => {
    if (mobileMenuClosing) return;
    if (mobileMenuOpen) {
      closeMobileMenu();
      return;
    }
    closeSuperMenuRef.current();
    closeSearchRef.current({ restoreFocus: false });
    setMobileMenuOpen(true);
    setMobileMenuClosing(false);
  }, [mobileMenuClosing, mobileMenuOpen, closeMobileMenu]);

  const closeSearch = useCallback((opts?: { restoreFocus?: boolean }) => {
    if (!searchOpen && !searchClosing) return;
    restoreSearchFocusRef.current = opts?.restoreFocus === true;
    setSearchClosing(true);
    setSearchOpen(false);
    if (searchCloseTimeoutRef.current) clearTimeout(searchCloseTimeoutRef.current);
    searchCloseTimeoutRef.current = setTimeout(() => {
      setSearchClosing(false);
      searchCloseTimeoutRef.current = null;
      if (restoreSearchFocusRef.current) {
        restoreSearchFocusRef.current = false;
        searchBtnRef.current?.focus();
      }
    }, motionMs(560));
  }, [searchOpen, searchClosing]);
  closeSearchRef.current = closeSearch;

  const openSearch = useCallback(() => {
    if (searchClosing) return;
    closeSuperMenuRef.current();
    /* Instant: animated close leaves menu overlay (z-40) over search for ~280ms */
    dismissMobileMenuInstant();
    setSearchOpen(true);
    setSearchClosing(false);
  }, [searchClosing, dismissMobileMenuInstant]);

  const toggleSearch = useCallback(() => {
    if (searchClosing) return;
    if (searchOpen) {
      closeSearch({ restoreFocus: true });
      return;
    }
    openSearch();
  }, [searchClosing, searchOpen, closeSearch, openSearch]);

  useEffect(() => {
    const onMenuCovered = () => {
      closeSuperMenuRef.current();
      closeSearchRef.current({ restoreFocus: false });
      dismissMobileMenuInstantRef.current();
    };
    window.addEventListener(MENU_COVERED_EVENT, onMenuCovered);
    return () => window.removeEventListener(MENU_COVERED_EVENT, onMenuCovered);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen || mobileMenuClosing) {
      setMobileMenuContentRevealed(false);
      return;
    }
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileMenuContentRevealed(true));
    });
    return () => cancelAnimationFrame(rafId);
  }, [mobileMenuOpen, mobileMenuClosing]);

  useEffect(() => {
    if (!mobileMenuOpen && !mobileMenuClosing) return;

    document.body.classList.add(BODY_MOBILE_MENU_OPEN);

    if (mobileMenuClosing) {
      return () => document.body.classList.remove(BODY_MOBILE_MENU_OPEN);
    }

    const panel = mobileMenuPanelRef.current;
    if (!panel) {
      return () => document.body.classList.remove(BODY_MOBILE_MENU_OPEN);
    }

    const closeBtn = panel.querySelector<HTMLElement>(`.${styles.mobileMenuCloseBtn}`);
    (closeBtn ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMobileMenu();
        return;
      }
      trapFocusKeydown(e, panel);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove(BODY_MOBILE_MENU_OPEN);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen, mobileMenuClosing, closeMobileMenu]);

  useEffect(() => {
    return () => {
      if (mobileMenuCloseTimeoutRef.current) clearTimeout(mobileMenuCloseTimeoutRef.current);
    };
  }, []);

  const toggleSection = (id: (typeof MENU_SECTIONS)[number]['id']) => {
    if (superMenuClosing) return;
    closeSearchRef.current();
    closeMobileMenuRef.current();
    if (superMenuOpen && section === id) {
      closeSuperMenu();
      return;
    }
    setSection(id);
    setSuperMenuOpen(true);
    setSuperMenuClosing(false);
  };

  useEffect(() => {
    const anyOpen = superMenuOpen || searchOpen;
    document.body.classList.toggle('header-super-menu-open', anyOpen);
    return () => document.body.classList.remove('header-super-menu-open');
  }, [superMenuOpen, searchOpen]);

  useEffect(() => {
    if (!superMenuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /* Поиск: Escape обрабатывает HeaderSearchPanel (clear → close + restore focus). */
      if (searchOpen) return;
      closeSuperMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [superMenuOpen, searchOpen, closeSuperMenu]);

  /* При скролле past hero закрываем супер-меню / моб. меню, но не поиск */
  useEffect(() => {
    if (!isLanding) return;
    if (prevVariantRef.current === 'minimal' && variant === 'main') {
      if (superMenuOpen) closeSuperMenu();
      if (mobileMenuOpen) closeMobileMenu();
    }
    prevVariantRef.current = variant;
  }, [
    variant,
    isLanding,
    superMenuOpen,
    mobileMenuOpen,
    closeSuperMenu,
    closeMobileMenu,
  ]);

  useEffect(() => {
    if (variant === 'main' && isMainOverlayOnHome) {
      setMainOverlayVisible(false);
      const t = setTimeout(() => setMainOverlayVisible(true), 20);
      return () => clearTimeout(t);
    }
    setMainOverlayVisible(false);
  }, [variant, isMainOverlayOnHome]);

  /* Replay logo wave when main appears after scroll */
  useEffect(() => {
    if (variant === 'main' && isMainOverlayOnHome) {
      logoRevealedRef.current = false;
      setLogoWaveSeq((s) => s + 1);
    }
  }, [variant, isMainOverlayOnHome]);

  useEffect(() => {
    const el = logoWaveRef.current;
    if (!el) return;

    let cancelled = false;
    let safetyTimer: number | undefined;

    const revealStatic = () => {
      resetLogoWaveVisible(el);
      logoRevealedRef.current = true;
      if (!cancelled) setLogoWaveReady(true);
    };

    const playWave = () => {
      if (cancelled) return;
      void (async () => {
        await preloadLogoWaveAnime();
        if (cancelled) return;
        if (variant === 'main' && isMainOverlayOnHome && !mainOverlayVisible) return;

        const distance = logoWaveDistance(el);
        prepareLogoWaveIn(el, distance);
        if (!cancelled) setLogoWaveReady(false);

        try {
          await animateLogoWaveIn(el, distance);
        } catch {
          resetLogoWaveVisible(el);
        } finally {
          if (cancelled) {
            resetLogoWaveVisible(el);
            return;
          }
          logoRevealedRef.current = true;
          setLogoWaveReady(true);
        }
      })();
    };

    if (variant === 'main' && isMainOverlayOnHome && !mainOverlayVisible) {
      return () => {
        cancelled = true;
        resetLogoWaveVisible(el);
      };
    }

    const isInitialWave = logoWaveSeq === 0 && !logoRevealedRef.current;
    const isReplayWave = logoWaveSeq > 0;

    if (logoRevealedRef.current && !isReplayWave) {
      revealStatic();
      return () => {
        cancelled = true;
        resetLogoWaveVisible(el);
      };
    }

    if (!isInitialWave && !isReplayWave) {
      return () => {
        cancelled = true;
        resetLogoWaveVisible(el);
      };
    }

    safetyTimer = window.setTimeout(() => {
      if (!cancelled && !logoRevealedRef.current) {
        revealStatic();
      }
    }, 3000);

    const waitForLoader =
      isInitialWave &&
      Boolean(document.querySelector('[data-site-loader]')) &&
      !document.body.classList.contains('--js-ready');

    if (!waitForLoader) {
      playWave();
      return () => {
        cancelled = true;
        window.clearTimeout(safetyTimer);
        resetLogoWaveVisible(el);
      };
    }

    const mo = new MutationObserver(() => {
      if (document.body.classList.contains('--js-ready')) {
        mo.disconnect();
        playWave();
      }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const fallback = window.setTimeout(() => {
      mo.disconnect();
      playWave();
    }, 4000);

    return () => {
      cancelled = true;
      mo.disconnect();
      window.clearTimeout(fallback);
      window.clearTimeout(safetyTimer);
      resetLogoWaveVisible(el);
    };
  }, [variant, mainOverlayVisible, isMainOverlayOnHome, logoWaveSeq]);

  useEffect(() => {
    if (variant !== 'minimal') {
      setLogoFading(false);
      return;
    }
    const hero = document.getElementById(HERO_SECTION_ID);
    if (!hero) {
      setLogoFading(false);
      return;
    }

    let raf = 0;
    const update = () => {
      const bottom = hero.getBoundingClientRect().bottom;
      setLogoFading(bottom < 160);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      setLogoFading(false);
    };
  }, [variant, pathname]);

  /* При смене landing-страницы сбрасываем fade и переигрываем wave-лого */
  useEffect(() => {
    if (!isLanding) return;
    setLogoFading(false);
    logoRevealedRef.current = false;
    setLogoWaveReady(false);
    setLogoWaveSeq((s) => s + 1);
  }, [pathname, isLanding]);

  const panelOpen = superMenuOpen || superMenuClosing;
  const searchPanelOpen = searchOpen || searchClosing;
  const mobileOverlayOpen = mobileMenuOpen || mobileMenuClosing;
  const headerElevated = panelOpen || searchPanelOpen || mobileOverlayOpen;
  const catalogSectionOpen = section === 'categories';
  const zonesSectionOpen = section === 'zones';

  const headerClass = [
    variant === 'minimal' ? styles.headerMinimal : styles.headerMain,
    variant === 'minimal' && isLightHero ? styles.headerOnLight : '',
    variant === 'minimal' && isAccount ? styles.headerOnAccount : '',
    isCheckout ? styles.headerCheckout : '',
    isMainOverlayOnHome && styles.headerMainOverlay,
    isMainOverlayOnHome && mainOverlayVisible && styles.headerMainOverlayVisible,
    panelOpen || searchPanelOpen ? styles.headerSuperMenuOpen : '',
    headerElevated ? styles.headerElevated : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClass}>
      <div className={styles.headerBar}>
        <div className="padding-global">
          <div className={styles.siteHeaderWrap}>
            <div
              className={[
                styles.logoBlock,
                variant === 'minimal' && logoFading ? styles.logoBlockFading : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Link href="/" className={styles.logoLink} aria-label="Jcos">
                {variant === 'main' ? (
                  <span className={styles.logoText}>Jcos</span>
                ) : (
                  <>
                    <span
                      className={styles.logoWaveMark}
                      ref={logoWaveRef}
                      aria-hidden={!logoWaveReady}
                    >
                      <LogoPaths className={styles.logoWaveSvg} />
                    </span>
                    <span className={styles.srOnly}>Jcos</span>
                  </>
                )}
              </Link>
            </div>

            {!isCheckout ? (
              <nav className={styles.siteHeaderNav} aria-label="Основное меню">
                <ul className={styles.siteHeaderMenu}>
                  {MENU_SECTIONS.map((item) => {
                    const open = superMenuOpen && section === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={styles.menuItem}
                          aria-expanded={open}
                          aria-controls="super-menu-panel"
                          onClick={() => toggleSection(item.id)}
                        >
                          <span>{item.label}</span>
                          <MenuChevron open={open} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : (
              <div className={styles.siteHeaderNav} aria-hidden />
            )}

            <div className={styles.rightNav}>
              {!isCheckout ? (
                <>
                  <button
                    ref={searchBtnRef}
                    type="button"
                    className={styles.iconBtn}
                    aria-label="Поиск"
                    aria-expanded={searchOpen}
                    aria-controls="header-search-panel"
                    onClick={toggleSearch}
                  >
                    <SearchIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    data-cart-trigger
                    aria-label={
                      hydrated && itemCount > 0 ? `Корзина, ${itemCount}` : 'Корзина'
                    }
                    onClick={openCart}
                  >
                    <BagIcon />
                    {hydrated && itemCount > 0 ? (
                      <span className={styles.cartCount}>{itemCount}</span>
                    ) : null}
                  </button>
                </>
              ) : null}
              {buyerAuthed ? (
                <Link
                  href="/account"
                  className={[styles.iconBtn, styles.accountNavBtn].join(' ')}
                  title="Личный кабинет"
                >
                  Профиль
                </Link>
              ) : (
                <Link
                  href={
                    isCheckout
                      ? '/login?from=/checkout'
                      : `/login?from=${encodeURIComponent(pathname || '/')}`
                  }
                  className={[styles.iconBtn, styles.accountNavBtn].join(' ')}
                >
                  Войти
                </Link>
              )}
              {!isCheckout ? (
                <button
                  type="button"
                  className={styles.burgerBtn}
                  aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
                  aria-expanded={mobileMenuOpen}
                  aria-controls={MOBILE_MENU_PANEL_ID}
                  onClick={toggleMobileMenu}
                >
                  <span
                    className={styles.burgerIcon}
                    aria-hidden
                    data-open={mobileMenuOpen || undefined}
                  >
                    <svg
                      className={styles.burgerIconSvg}
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 6h18M3 12h18M3 18h18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <svg
                      className={styles.closeIconSvg}
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!isCheckout ? (
        <div
          id="super-menu-panel"
          className={`${styles.superMenu} ${superMenuClosing ? styles.superMenuClosing : ''}`.trim()}
          aria-hidden={!panelOpen}
        >
          <div className={styles.superMenuSlideWrap}>
            <div className={styles.superMenuBg} />
            <div className={styles.superMenuPanel}>
              <div className="padding-global">
                <div className={styles.siteHeaderWrap}>
                  <div className={styles.superMenuPanelInner}>
                    <div
                      className={styles.superMenuSection}
                      hidden={!catalogSectionOpen}
                      data-active={catalogSectionOpen || undefined}
                    >
                      <div className={styles.superMenuSectionWrap}>
                        <div className={styles.superMenuLogoBlock} aria-hidden />
                        <div className={styles.superMenuMenuCol}>
                          <ul className={styles.superMenuLinks} role="list">
                            {catalogLinks.map((l) => (
                              <li key={l.href}>
                                <TransitionLink href={l.href} fromMenu>
                                  {l.label}
                                </TransitionLink>
                              </li>
                            ))}
                          </ul>
                          <TransitionLink
                            href="/catalog"
                            className={styles.superMenuCatalogLink}
                            fromMenu
                          >
                            В каталог
                          </TransitionLink>
                        </div>
                        <div
                          className={styles.superMenuTagsPanel}
                          role="region"
                          aria-label="Области применения с обложками"
                        >
                          {zoneLinks.length > 0 ? (
                            <div className={styles.superMenuZoneCards}>
                              {zoneLinks.map((l) => (
                                <TransitionLink
                                  key={`card-${l.href}`}
                                  href={l.href}
                                  className={styles.superMenuZoneCard}
                                  fromMenu
                                >
                                  {l.coverImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      className={styles.superMenuZoneCardImg}
                                      src={l.coverImageUrl}
                                      alt=""
                                    />
                                  ) : (
                                    <span className={styles.superMenuZoneCardPh} aria-hidden />
                                  )}
                                  <span className={styles.superMenuZoneCardTitle}>{l.label}</span>
                                </TransitionLink>
                              ))}
                            </div>
                          ) : (
                            <span className={styles.superMenuTagsEmpty}>—</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={styles.superMenuSection}
                      hidden={!zonesSectionOpen}
                      data-active={zonesSectionOpen || undefined}
                    >
                      <div className={styles.superMenuSectionWrap}>
                        <div className={styles.superMenuLogoBlock} aria-hidden />
                        <div className={styles.superMenuMenuCol}>
                          <ul className={styles.superMenuLinks} role="list">
                            {zoneLinks.length > 0 ? (
                              zoneLinks.map((l) => (
                                <li key={l.href}>
                                  <TransitionLink href={l.href} fromMenu>
                                    {l.label}
                                  </TransitionLink>
                                </li>
                              ))
                            ) : (
                              <li>
                                <span className={styles.superMenuTagsEmpty}>Нет зон</span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!isCheckout ? (
        <HeaderSearchPanel
          open={searchOpen}
          closing={searchClosing}
          onClose={() => closeSearch({ restoreFocus: true })}
          onNavigate={() => closeSearch({ restoreFocus: false })}
        />
      ) : null}

      {!isCheckout ? (
        <div
          className={[
            styles.mobileMenuOverlay,
            mobileMenuOpen || mobileMenuClosing ? styles.mobileMenuOverlayOpen : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!mobileMenuOpen && !mobileMenuClosing}
          style={{
            pointerEvents: mobileMenuOpen || mobileMenuClosing ? 'auto' : 'none',
          }}
        >
          <div
            id={MOBILE_MENU_PANEL_ID}
            ref={mobileMenuPanelRef}
            className={[
              'padding-global',
              styles.mobileMenuPanel,
              mobileMenuOpen && styles.mobileMenuPanelOpen,
              mobileMenuContentRevealed && styles.mobileMenuContentRevealed,
              mobileMenuClosing && styles.mobileMenuClosing,
            ]
              .filter(Boolean)
              .join(' ')}
            role="dialog"
            aria-modal="true"
            aria-label="Мобильное меню"
            tabIndex={-1}
          >
            <div className={styles.mobileMenuHeader}>
              <Link
                href="/"
                onClick={closeMobileMenu}
                className={styles.mobileMenuLogoLink}
                aria-label="На главную"
              >
                Jcos
              </Link>
              <button
                type="button"
                className={styles.mobileMenuCloseBtn}
                aria-label="Закрыть меню"
                onClick={closeMobileMenu}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.mobileMenuScroll}>
              <div className={styles.mobileMenuInner}>
                <nav className={styles.mobileMenuNav} aria-label="Основное меню">
                  {MENU_SECTIONS.map(({ id, href, label }) => {
                    if (id === 'categories') {
                      return (
                        <div key={id} className={styles.mobileMenuItem}>
                          <button
                            type="button"
                            className={styles.mobileMenuTrigger}
                            onClick={() => {
                              setMobileMenuCatalogOpen((o) => !o);
                              setMobileMenuZonesOpen(false);
                            }}
                            aria-expanded={mobileMenuCatalogOpen}
                            aria-controls={MOBILE_MENU_CATALOG_ID}
                          >
                            <span className={styles.mobileMenuTriggerRow}>
                              <span className={styles.mobileMenuTriggerText}>{label}</span>
                              <span
                                className={styles.mobileMenuArrow}
                                aria-hidden
                                data-open={mobileMenuCatalogOpen || undefined}
                              >
                                <svg width="9" height="5" viewBox="0 0 9 5" fill="none">
                                  <path
                                    d="M0 0L4.5 5L9 0"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                  />
                                </svg>
                              </span>
                            </span>
                          </button>
                          <div
                            id={MOBILE_MENU_CATALOG_ID}
                            className={styles.mobileMenuSublinks}
                            hidden={!mobileMenuCatalogOpen}
                          >
                            {catalogLinks.map((sub) => (
                              <TransitionLink
                                key={sub.href}
                                href={sub.href}
                                className={styles.mobileMenuSublink}
                                fromMenu
                                onClick={closeMobileMenu}
                              >
                                {sub.label}
                              </TransitionLink>
                            ))}
                            <TransitionLink
                              href={href}
                              className={styles.mobileMenuShowAll}
                              fromMenu
                              onClick={closeMobileMenu}
                            >
                              В каталог
                            </TransitionLink>
                          </div>
                        </div>
                      );
                    }

                    if (id === 'zones') {
                      return (
                        <div key={id} className={styles.mobileMenuItem}>
                          <button
                            type="button"
                            className={styles.mobileMenuTrigger}
                            onClick={() => {
                              setMobileMenuZonesOpen((o) => !o);
                              setMobileMenuCatalogOpen(false);
                            }}
                            aria-expanded={mobileMenuZonesOpen}
                            aria-controls={MOBILE_MENU_ZONES_ID}
                          >
                            <span className={styles.mobileMenuTriggerRow}>
                              <span className={styles.mobileMenuTriggerText}>{label}</span>
                              <span
                                className={styles.mobileMenuArrow}
                                aria-hidden
                                data-open={mobileMenuZonesOpen || undefined}
                              >
                                <svg width="9" height="5" viewBox="0 0 9 5" fill="none">
                                  <path
                                    d="M0 0L4.5 5L9 0"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                  />
                                </svg>
                              </span>
                            </span>
                          </button>
                          <div
                            id={MOBILE_MENU_ZONES_ID}
                            className={styles.mobileMenuSublinks}
                            hidden={!mobileMenuZonesOpen}
                          >
                            {zoneLinks.length > 0 ? (
                              zoneLinks.map((sub) => (
                                <TransitionLink
                                  key={sub.href}
                                  href={sub.href}
                                  className={styles.mobileMenuSublink}
                                  fromMenu
                                  onClick={closeMobileMenu}
                                >
                                  {sub.label}
                                </TransitionLink>
                              ))
                            ) : (
                              <span className={styles.mobileMenuSublink}>Нет зон</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </nav>
              </div>

              <div className={styles.mobileMenuInner}>
                <nav className={styles.mobileMenuSimpleNav} aria-label="Информация">
                  {MOBILE_INFO_LINKS.map((link) => (
                    <TransitionLink
                      key={link.href}
                      href={link.href}
                      className={styles.mobileMenuSimpleLink}
                      fromMenu
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </TransitionLink>
                  ))}
                </nav>
              </div>

              <div className={styles.mobileMenuInner}>
                <div className={styles.mobileMenuActions}>
                  <button
                    type="button"
                    className={styles.mobileMenuSearchBtn}
                    aria-label="Поиск"
                    onClick={openSearch}
                  >
                    <SearchIcon />
                    <span>Поиск</span>
                  </button>
                  <Link
                    href={
                      buyerAuthed
                        ? '/account'
                        : `/login?from=${encodeURIComponent(pathname || '/')}`
                    }
                    className={styles.mobileMenuLoginLink}
                    onClick={closeMobileMenu}
                  >
                    {buyerAuthed ? 'Профиль' : 'Войти'}
                  </Link>
                </div>
              </div>

              <div className={styles.mobileMenuBottom} />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
