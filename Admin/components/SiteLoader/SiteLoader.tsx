'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LogoPaths } from './LogoPaths';
import {
  animateLogoWaveIn,
  animateLogoWaveOut,
  loadAnime,
  logoWaveDistance,
  prepareLogoWaveIn,
} from './logoWave';

const BOOT_LOADER_ID = 'site-boot-loader';

const HOLD_AFTER_IN_MS = 280;
const BG_COLLAPSE_DURATION = 700;
/** If JS/chunks stall (slow network), do not block the site behind the loader forever. */
const LOADER_MAX_MS = 8000;

function removeBootLoader() {
  try {
    document.getElementById(BOOT_LOADER_ID)?.remove();
  } catch {
    /* ignore */
  }
}

function markReady() {
  document.body.classList.add('--js-ready');
}

export function SiteLoader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [shouldShow, setShouldShow] = useState(false);

  useLayoutEffect(() => {
    removeBootLoader();
    setShouldShow(true);
  }, []);

  useEffect(() => {
    if (!shouldShow || !rootRef.current || !bgRef.current || !logoRef.current) return;

    let cancelled = false;
    const logoEl = logoRef.current;
    const distance = logoWaveDistance(logoEl);
    prepareLogoWaveIn(logoEl, distance);

    const finishLoader = () => {
      if (cancelled) return;
      markReady();
      _destroy();
    };

    const maxTimer = window.setTimeout(finishLoader, LOADER_MAX_MS);

    const runSequence = async () => {
      const bgEl = bgRef.current;
      if (!logoEl || !bgEl || cancelled) return;

      try {
        await animateLogoWaveIn(logoEl, distance);
        if (cancelled) return;

        await new Promise((r) => setTimeout(r, HOLD_AFTER_IN_MS));
        if (cancelled) return;

        await animateLogoWaveOut(logoEl, distance);
        if (cancelled) return;

        markReady();
        const { animate } = await loadAnime();
        if (cancelled) return;

        await animate(bgEl, {
          translateY: '100%',
          duration: BG_COLLAPSE_DURATION,
          ease: 'inQuad',
        });
      } catch {
        /* chunk/network failure — fall through to finishLoader */
      }
      if (!cancelled) finishLoader();
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void runSequence();
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
      cancelAnimationFrame(frame);
    };
  }, [shouldShow]);

  function _destroy() {
    const el = rootRef.current;
    if (!el) return;
    el.style.pointerEvents = 'none';
    el.style.visibility = 'hidden';
    // Не removeChild — React сам снимет узел; иначе NotFoundError при уходе со страницы.
    setShouldShow(false);
  }

  if (!shouldShow) return null;

  return (
    <div className="site-loader" data-site-loader aria-hidden="true" ref={rootRef}>
      <div className="site-loader__bg" ref={bgRef} />
      <div className="site-loader__logo" ref={logoRef}>
        <LogoPaths />
      </div>
    </div>
  );
}
