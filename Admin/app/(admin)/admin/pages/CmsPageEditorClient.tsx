'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminRichField } from '@/components/admin/AdminRichField/AdminRichField';
import { AdminTextField } from '@/components/AdminTextField/AdminTextField';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  AdminBackendRequestError,
  adminBackendJson,
  adminBackendPath,
} from '@/lib/adminBackendFetch';
import { revalidateCmsStorefront } from '@/lib/revalidateCmsStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import blogStyles from '@/app/(admin)/admin/blog/blogAdmin.module.css';
import pn from '@/app/(admin)/admin/catalog/products/productNew.module.css';

const LEGAL_SLUGS = ['privacy', 'terms', 'delivery'] as const;
const CMS_PAGE_SLUGS = [...LEGAL_SLUGS, 'about'] as const;

type CmsPageApi = {
  id: string | null;
  slug: string;
  title: string;
  bodyHtml: string;
  isPublished: boolean;
};

function isCmsPageSlug(slug: string): slug is (typeof CMS_PAGE_SLUGS)[number] {
  return (CMS_PAGE_SLUGS as readonly string[]).includes(slug);
}

function isLegalSlug(slug: string): boolean {
  return (LEGAL_SLUGS as readonly string[]).includes(slug as (typeof LEGAL_SLUGS)[number]);
}

function backHrefForSlug(slug: string): { href: string; label: string } {
  if (slug === 'about') return { href: '/admin/pages?tab=about', label: '← О нас' };
  return { href: '/admin/pages?tab=legal', label: '← Юр. инфо' };
}

function discardSessionUploads(urls: string[]) {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) return;
  const body = JSON.stringify({ urls: unique });
  try {
    void fetch(adminBackendPath('cms/admin/discard-uploads'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}

function mediaUrlsFromHtml(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/src=["']([^"']+)["']/gi)) {
    const u = m[1]?.trim();
    if (u) out.push(u);
  }
  return out;
}

type Props = { slug: string };

export function CmsPageEditorClient({ slug }: Props) {
  const { showToast } = useToast();
  const sessionUploadsRef = useRef<Set<string>>(new Set());
  const savedMediaRef = useRef<Set<string>>(new Set());
  const back = backHrefForSlug(slug);

  const [loading, setLoading] = useState(true);
  const [loadedOk, setLoadedOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [isPublished, setIsPublished] = useState(true);

  const markDirty = useCallback(() => setDirty(true), []);

  function trackUpload(url: string) {
    const t = url.trim();
    if (!t) return;
    sessionUploadsRef.current.add(t);
  }

  function markSavedMedia(html: string) {
    const kept = new Set(mediaUrlsFromHtml(html));
    savedMediaRef.current = kept;
    for (const u of kept) sessionUploadsRef.current.delete(u);
  }

  const load = useCallback(async () => {
    if (!slug) return;
    if (!isCmsPageSlug(slug)) {
      setLoading(false);
      setLoadedOk(false);
      setLoadError(
        'Недопустимая страница. Доступны: privacy, terms, delivery, about.',
      );
      return;
    }
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setLoadedOk(false);
    try {
      const row = await adminBackendJson<CmsPageApi>(`cms/admin/pages/${slug}`);
      const html = row.bodyHtml || '<p></p>';
      setTitle(row.title);
      setBodyHtml(html);
      setIsPublished(row.isPublished);
      markSavedMedia(html);
      sessionUploadsRef.current.clear();
      setDirty(false);
      setLoadedOk(true);
    } catch (e) {
      setLoadedOk(false);
      setLoadError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      const orphans = [...sessionUploadsRef.current].filter(
        (u) => !savedMediaRef.current.has(u),
      );
      discardSessionUploads(orphans);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk || !slug || !isCmsPageSlug(slug)) return;
    if (!title.trim()) {
      showToast('Укажите заголовок');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const row = await adminBackendJson<CmsPageApi>(`cms/admin/pages/${slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: title.trim(),
          bodyHtml: bodyHtml.trim() || '<p></p>',
          isPublished,
        }),
      });
      const html = row.bodyHtml || '<p></p>';
      setTitle(row.title);
      setBodyHtml(html);
      setIsPublished(row.isPublished);
      const leftovers = [...sessionUploadsRef.current];
      markSavedMedia(html);
      discardSessionUploads(leftovers.filter((u) => !savedMediaRef.current.has(u)));
      setDirty(false);
      showToast('Сохранено');
      const ok = await revalidateCmsStorefront(slug);
      if (!ok) showToast('Сохранено, но кэш витрины не обновился');
    } catch (err) {
      const msg =
        err instanceof AdminBackendRequestError ? err.message : 'Ошибка сохранения';
      setActionError(msg);
      showToast(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={catalogStyles.lead}>Загрузка…</p>;
  }

  if (!loadedOk) {
    return (
      <div>
        <div className={catalogStyles.formActions} style={{ marginBottom: 12 }}>
          <AdminCompactBtnLink href={back.href} variant="outline">
            {back.label}
          </AdminCompactBtnLink>
        </div>
        <div className={catalogStyles.errorBanner} role="alert">
          <span>{loadError ?? 'Не удалось загрузить страницу. Сохранение отключено.'}</span>
          {isCmsPageSlug(slug) ? (
            <AdminCompactBtn type="button" variant="outline" onClick={() => void load()}>
              Повторить
            </AdminCompactBtn>
          ) : null}
        </div>
      </div>
    );
  }

  const titleText = title.trim() || slug;
  const storefrontHref = isPublished ? `/${slug}` : null;
  const canSave = dirty && !saving;

  return (
    <form
      onSubmit={(e) => void onSave(e)}
      className={`${catalogStyles.form} ${catalogStyles.formWide}`}
    >
      <div className={pn.stickyToolbar}>
        <div className={pn.stickyToolbarMain}>
          <AdminCompactBtnLink href={back.href} variant="outline">
            {back.label}
          </AdminCompactBtnLink>
          <h1 className={pn.stickyToolbarTitle}>{titleText}</h1>
          <div className={pn.stickyToolbarMeta}>
            {storefrontHref ? (
              <a
                className={pn.storefrontLink}
                href={storefrontHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть на сайте ↗
              </a>
            ) : (
              <span className={pn.dirtyHintInline}>Черновик — на витрине не виден</span>
            )}
            {dirty ? (
              <span className={pn.dirtyHintInline}>Есть несохранённые изменения</span>
            ) : null}
          </div>
        </div>
        <div className={pn.stickyToolbarActions}>
          <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </AdminCompactBtn>
        </div>
      </div>

      {actionError ? (
        <div className={catalogStyles.errorBanner} role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className={catalogStyles.errorBannerDismiss}
            onClick={() => setActionError(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ) : null}

      <AdminTextField
        label="Заголовок"
        value={title}
        onChange={(e) => {
          markDirty();
          setTitle(e.target.value);
        }}
        disabled={saving}
      />
      <p className={catalogStyles.lead}>
        URL: <code>/{slug}</code>
        {isLegalSlug(slug) ? null : (
          <>
            {' '}
            · блоки из Saleor (картинка + текст) сведены в один HTML
          </>
        )}
      </p>
      <label className={blogStyles.publishedRow}>
        <AdminCheckbox
          checked={isPublished}
          onChange={(e) => {
            markDirty();
            setIsPublished(e.target.checked);
          }}
          disabled={saving}
        />
        Опубликовано
      </label>
      <AdminRichField
        label="Текст"
        value={bodyHtml}
        onChange={(v) => {
          markDirty();
          setBodyHtml(v);
        }}
        onUploaded={trackUpload}
        uploadPath="catalog/admin/upload-rich-media?type=image"
        tall
      />
    </form>
  );
}
