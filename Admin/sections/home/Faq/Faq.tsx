'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { faqAnswerToHtml } from '@/lib/faqAnswerHtml';
import styles from './Faq.module.css';

export type FaqItemView = {
  id: string;
  question: string;
  answer: string;
};

type Props = {
  title?: string;
  items: FaqItemView[];
  /** id секции для якоря */
  id?: string;
  /** Deep-link: `/faq?q=<id>` или `#faq-<id>` */
  initialOpenId?: string | null;
};

export function itemAnchorId(itemId: string) {
  return `faq-${itemId}`;
}

function resolveDeepLinkId(
  items: FaqItemView[],
  q: string | null | undefined,
  hash: string,
): string | null {
  const ids = new Set(items.map((i) => i.id));
  if (q && ids.has(q)) return q;
  const fromHash = hash.replace(/^#/, '');
  if (!fromHash) return null;
  if (ids.has(fromHash)) return fromHash;
  const m = fromHash.match(/^faq-(.+)$/);
  if (m && ids.has(m[1]!)) return m[1]!;
  return null;
}

export function Faq({
  title = 'FAQ',
  items,
  id = 'faq',
  initialOpenId = null,
}: Props) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(() =>
    initialOpenId && items.some((i) => i.id === initialOpenId) ? initialOpenId : null,
  );

  useEffect(() => {
    const fromUrl = resolveDeepLinkId(
      items,
      initialOpenId,
      typeof window !== 'undefined' ? window.location.hash : '',
    );
    if (!fromUrl) return;
    setOpenId(fromUrl);
    requestAnimationFrame(() => {
      document.getElementById(itemAnchorId(fromUrl))?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    });
  }, [items, initialOpenId]);

  const syncUrl = useCallback((itemId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (itemId) {
      url.searchParams.set('q', itemId);
      url.hash = itemAnchorId(itemId);
    } else {
      url.searchParams.delete('q');
      url.hash = '';
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const onToggle = useCallback(
    (itemId: string) => {
      setOpenId((prev) => {
        const next = prev === itemId ? null : itemId;
        syncUrl(next);
        return next;
      });
    },
    [syncUrl],
  );

  if (!items.length) return null;

  return (
    <section id={id} className={styles.section} aria-label={title}>
      <div className={`padding-global ${styles.inner}`}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.list}>
          {items.map((item) => {
            const open = openId === item.id;
            const panelId = `${baseId}-${item.id}`;
            const html = faqAnswerToHtml(item.answer);
            return (
              <div key={item.id} id={itemAnchorId(item.id)} className={styles.item}>
                <button
                  type="button"
                  className={styles.trigger}
                  aria-expanded={open}
                  aria-controls={panelId}
                  id={`${panelId}-trigger`}
                  onClick={() => onToggle(item.id)}
                >
                  <span className={styles.question}>{item.question}</span>
                  <span
                    className={styles.chevron}
                    data-open={open || undefined}
                    aria-hidden
                  >
                    <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                      <path
                        d="M11 4v14M4 11h14"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={`${panelId}-trigger`}
                  hidden={!open}
                  className={styles.panel}
                >
                  <div
                    className={styles.answer}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
