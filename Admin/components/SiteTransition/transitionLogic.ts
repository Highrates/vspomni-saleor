'use client';

const TRANSITION_DURATION = 280;
const MENU_EXIT_DURATION = 650;
const MENU_ENTER_DURATION = 750;
const MENU_HOLD_MS = 450;
const TRANSITION_EASE = 'inOutCubic';

export const MENU_COVERED_EVENT = 'site-transition:menu-covered';
export const TRANSITION_ENTER_COMPLETE_EVENT = 'site-transition:enter-complete';

let overlayEl: HTMLDivElement | null = null;
let bgEl: HTMLDivElement | null = null;
let lastExitContext: TransitionContext = 'default';
let menuExitCompletedAt = 0;
let enterInProgress = false;
let animateFn: typeof import('animejs').animate | null = null;
let animateLoadPromise: Promise<typeof import('animejs').animate> | null = null;

async function getAnimate() {
  if (!animateFn) {
    if (!animateLoadPromise) {
      animateLoadPromise = import('@/lib/anime').then(async ({ loadAnime }) => {
        const mod = await loadAnime();
        animateFn = mod.animate;
        return animateFn;
      });
    }
    animateFn = await animateLoadPromise;
  }
  return animateFn;
}

/** Прогрев anime.js до первого клика — иначе ширма «мелькает» во время dynamic import. */
export function preloadTransitionAnimate() {
  void getAnimate();
}

export type TransitionContext = 'default' | 'menu';

export function registerTransitionElements(
  overlay: HTMLDivElement | null,
  bg: HTMLDivElement | null,
) {
  overlayEl = overlay;
  bgEl = bg;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exit(nextContext: TransitionContext = 'default'): Promise<void> {
  if (!overlayEl || !bgEl) return;
  lastExitContext = nextContext;
  const animate = await getAnimate();

  if (nextContext === 'menu') {
    setTransitionBgInkBlack();
    bgEl.style.opacity = '';
    bgEl.style.transform = 'translateY(-100%)';
    overlayEl.classList.remove('visibility-hidden', 'pointer-events-none');
    overlayEl.getBoundingClientRect();
    await animate(bgEl, {
      translateY: 0,
      duration: MENU_EXIT_DURATION,
      ease: TRANSITION_EASE,
    });
    menuExitCompletedAt = Date.now();
    window.dispatchEvent(new CustomEvent(MENU_COVERED_EVENT));
    return;
  }

  bgEl.style.transform = '';
  bgEl.style.opacity = '0';
  overlayEl.classList.remove('visibility-hidden', 'pointer-events-none');
  overlayEl.getBoundingClientRect();
  await animate(bgEl, {
    opacity: 1,
    duration: TRANSITION_DURATION,
    ease: TRANSITION_EASE,
  });
}

export function entering(): void {
  document.documentElement.style.setProperty('--site-transition-entering', '1');
}

export async function enter(fromMenu?: boolean): Promise<void> {
  if (!overlayEl || !bgEl || enterInProgress) return;

  const fromMenuTransition = fromMenu ?? lastExitContext === 'menu';
  if (!fromMenuTransition) {
    document.documentElement.style.removeProperty('--site-transition-entering');
  }

  enterInProgress = true;
  try {
    const animate = await getAnimate();

    if (fromMenuTransition) {
      const elapsedSinceCover = Date.now() - menuExitCompletedAt;
      const holdRemaining = Math.max(0, MENU_HOLD_MS - elapsedSinceCover);
      if (holdRemaining > 0) {
        await waitMs(holdRemaining);
      }
      await waitForPaint();

      document.documentElement.style.removeProperty('--site-transition-entering');

      await animate(bgEl, {
        translateY: '100%',
        duration: MENU_ENTER_DURATION,
        ease: TRANSITION_EASE,
      });
      bgEl.style.transform = '';
      overlayEl.classList.add('visibility-hidden', 'pointer-events-none');
      lastExitContext = 'default';
      menuExitCompletedAt = 0;
      window.dispatchEvent(
        new CustomEvent(TRANSITION_ENTER_COMPLETE_EVENT, { detail: { fromMenu: true } }),
      );
      return;
    }

    await animate(bgEl, {
      opacity: 0,
      duration: TRANSITION_DURATION,
      ease: TRANSITION_EASE,
    });
    bgEl.style.opacity = '';
    overlayEl.classList.add('visibility-hidden', 'pointer-events-none');
    window.dispatchEvent(
      new CustomEvent(TRANSITION_ENTER_COMPLETE_EVENT, { detail: { fromMenu: false } }),
    );
  } finally {
    enterInProgress = false;
  }
}

const BG_COLOR_CLASSES = ['bg-color-white', 'bg-color-black', 'bg-color-ink-black'] as const;

function clearTransitionBgClasses() {
  if (bgEl) {
    bgEl.classList.remove(...BG_COLOR_CLASSES);
  }
}

export function setTransitionBgWhite() {
  if (bgEl) {
    clearTransitionBgClasses();
    bgEl.classList.add('bg-color-white');
  }
}

export function setTransitionBgBlack() {
  if (bgEl) {
    clearTransitionBgClasses();
    bgEl.classList.add('bg-color-black');
  }
}

export function setTransitionBgInkBlack() {
  if (bgEl) {
    clearTransitionBgClasses();
    bgEl.classList.add('bg-color-ink-black');
  }
}
