'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTabs } from '@/components/AdminTabs/AdminTabs';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { formatAdminDateTime } from '@/lib/adminFormat';
import type { AdminCmsLegalRow } from '@/lib/adminCmsTypes';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import { BlogListClient } from '@/app/(admin)/admin/blog/BlogListClient';

/** Строка about / legal в hub (id null до первого save). */
type CmsRow = AdminCmsLegalRow;

type Tab = 'blog' | 'about' | 'legal';

function tabFromQuery(raw: string | null): Tab {
  if (raw === 'legal') return 'legal';
  if (raw === 'about') return 'about';
  return 'blog';
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`${catalogStyles.badge} ${
        published ? catalogStyles.badgeOn : catalogStyles.badgeDraft
      }`}
    >
      {published ? 'Опубликовано' : 'Черновик'}
    </span>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PagesAdminClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromQuery(searchParams.get('tab'));
  const [legal, setLegal] = useState<CmsRow[]>([]);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [about, setAbout] = useState<CmsRow | null>(null);
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);

  const setTab = (next: Tab) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === 'blog') sp.delete('tab');
    else sp.set('tab', next);
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  const loadLegal = useCallback(async () => {
    setLegalLoading(true);
    setLegalError(null);
    try {
      const data = await adminBackendJson<{ items: CmsRow[] }>('cms/admin/legal');
      setLegal(data.items ?? []);
    } catch (e) {
      setLegal([]);
      setLegalError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки');
    } finally {
      setLegalLoading(false);
    }
  }, []);

  const loadAbout = useCallback(async () => {
    setAboutLoading(true);
    setAboutError(null);
    try {
      const data = await adminBackendJson<{ item: CmsRow }>('cms/admin/about');
      setAbout(data.item ?? null);
    } catch (e) {
      setAbout(null);
      setAboutError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки');
    } finally {
      setAboutLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'legal') void loadLegal();
    if (tab === 'about') void loadAbout();
  }, [tab, loadLegal, loadAbout]);

  return (
    <div>
      <h1 className={catalogStyles.title}>Страницы</h1>

      <AdminTabs
        ariaLabel="Разделы страниц"
        variant="underline"
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: 'blog', label: 'Блог' },
          { id: 'about', label: 'О нас' },
          { id: 'legal', label: 'Юр. инфо' },
        ]}
      />

      {tab === 'blog' ? (
        <BlogListClient embedded />
      ) : tab === 'about' ? (
        <div>
          {aboutError ? (
            <div className={catalogStyles.errorBanner} role="alert">
              <span>{aboutError}</span>
              <AdminCompactBtn type="button" variant="outline" onClick={() => void loadAbout()}>
                Повторить
              </AdminCompactBtn>
            </div>
          ) : null}
          {aboutLoading ? (
            <p className={catalogStyles.lead}>Загрузка…</p>
          ) : aboutError ? (
            <p className={catalogStyles.lead}>Не удалось загрузить страницу «О нас».</p>
          ) : about ? (
            <div className={catalogStyles.tableWrap}>
              <table className={catalogStyles.table}>
                <thead>
                  <tr>
                    <th>Страница</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{about.title}</td>
                    <td>
                      <StatusBadge published={about.isPublished} />
                    </td>
                    <td className={catalogStyles.mutedInline}>
                      {about.updatedAt ? formatAdminDateTime(about.updatedAt) : '—'}
                    </td>
                    <td className={catalogStyles.tableCellActions}>
                      <div className={catalogStyles.actionGroup}>
                        <AdminCompactBtnLink
                          href="/admin/pages/about"
                          variant="outline"
                          className={catalogStyles.iconBtn}
                          aria-label="Изменить «О нас»"
                          title="Изменить"
                        >
                          <EditIcon />
                        </AdminCompactBtnLink>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          {legalError ? (
            <div className={catalogStyles.errorBanner} role="alert">
              <span>{legalError}</span>
              <AdminCompactBtn type="button" variant="outline" onClick={() => void loadLegal()}>
                Повторить
              </AdminCompactBtn>
            </div>
          ) : null}
          {legalLoading ? (
            <p className={catalogStyles.lead}>Загрузка…</p>
          ) : legalError ? (
            <p className={catalogStyles.lead}>Не удалось загрузить юр. страницы.</p>
          ) : (
            <div className={catalogStyles.tableWrap}>
              <table className={catalogStyles.table}>
                <thead>
                  <tr>
                    <th>Страница</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {legal.map((row) => (
                    <tr key={row.slug}>
                      <td>{row.title}</td>
                      <td>
                        <StatusBadge published={row.isPublished} />
                      </td>
                      <td className={catalogStyles.mutedInline}>
                        {row.updatedAt ? formatAdminDateTime(row.updatedAt) : '—'}
                      </td>
                      <td className={catalogStyles.tableCellActions}>
                        <div className={catalogStyles.actionGroup}>
                          <AdminCompactBtnLink
                            href={`/admin/pages/legal/${row.slug}`}
                            variant="outline"
                            className={catalogStyles.iconBtn}
                            aria-label={`Изменить «${row.title}»`}
                            title="Изменить"
                          >
                            <EditIcon />
                          </AdminCompactBtnLink>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
