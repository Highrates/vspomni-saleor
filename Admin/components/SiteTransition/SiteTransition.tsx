'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import * as transition from './transitionLogic';

function isAuthPath(p: string) {
  return (
    p === '/login' ||
    p.startsWith('/login/') ||
    p === '/register' ||
    p.startsWith('/register/')
  );
}

function isCheckoutPath(p: string) {
  return p === '/checkout' || p.startsWith('/checkout/');
}

export function SiteTransition() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isFirstMount = useRef(true);
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    transition.preloadTransitionAnimate();
    if (!overlayRef.current || !bgRef.current) return;
    transition.registerTransitionElements(overlayRef.current, bgRef.current);
    return () => {
      transition.registerTransitionElements(null, null);
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevPathnameRef.current = pathname;
      return;
    }

    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (prev != null && isAuthPath(prev) && isAuthPath(pathname)) {
      return;
    }
    // Checkout chrome меняет Header/Footer без remount providers — ширма мешает DOM.
    if (
      isCheckoutPath(pathname) ||
      (prev != null && isCheckoutPath(prev))
    ) {
      return;
    }

    transition.enter().catch(() => {
      /* ignore — overlay may be unmounted */
    });
  }, [pathname]);

  return (
    <div
      className="site-transition visibility-hidden pointer-events-none"
      data-site-transition
      aria-hidden="true"
      ref={overlayRef}
    >
      <div className="site-transition__bg bg-color-white" ref={bgRef} />
    </div>
  );
}
