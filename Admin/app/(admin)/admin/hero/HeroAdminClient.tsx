'use client';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assertHeroPlaqueComplete,
  heroPlaqueTitleLines,
  HERO_PLAQUE_HREF_DEFAULT,
  HERO_PLAQUE_TEMPLATE_SEED_HREF,
  HERO_SLIDE_HREF_DEFAULT,
  normalizeHeroPlaque,
  type HeroPlaque,
  type HeroPlaqueTemplate,
  type HeroSlideAdmin,
} from '@vspomni/hero-types';
import { toRelativeMediaPath } from '@vspomni/media-path';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminSettingsListErrors } from '@/components/admin/AdminSettingsListErrors/AdminSettingsListErrors';
import { AdminTabs, AdminTabsPanel } from '@/components/AdminTabs/AdminTabs';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  AdminBackendRequestError,
  adminBackendFetch,
  adminBackendJson,
  readAdminApiError,
} from '@/lib/adminBackendFetch';
import { useAdminSettingsListShell } from '@/lib/useAdminSettingsListShell';
import {
  homeRevalidateLagToast,
  revalidateHomeStorefront,
} from '@/lib/revalidateHomeStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from '@/app/(admin)/admin/settings/Settings.module.css';

type HeroTab = 'slides' | 'template';

type SlideDraft = {
  key: string;
  id?: string;
  imageUrl: string;
  mobileImageUrl: string;
  href: string;
  /** Каноническая плашка; null = без плашки на витрине */
  plaque: HeroPlaque | null;
  active: boolean;
};

/** Seed контента шаблона (не fallback пустого href плашки — тот HERO_PLAQUE_HREF_DEFAULT). */
const TEMPLATE_DEFAULTS: HeroPlaqueTemplate = {
  title: 'Аромат, что остаётся. История, что звучит в памяти',
  subtitle: 'Каждый аромат — это история, сотканная из чувств, мгновений и памяти.',
  imageUrl: '/images/hero-badge.png',
  href: HERO_PLAQUE_TEMPLATE_SEED_HREF,
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUploadUrl(url: string): string {
  return toRelativeMediaPath(url) || url.trim();
}

function emptyPlaque(template?: HeroPlaqueTemplate): HeroPlaque {
  return {
    title: template?.title?.trim() || '',
    subtitle: template?.subtitle?.trim() || '',
    imageUrl: template?.imageUrl?.trim() || '',
    href: template?.href?.trim() || HERO_PLAQUE_HREF_DEFAULT,
  };
}

function mapApiItem(it: HeroSlideAdmin): SlideDraft {
  return {
    key: it.id,
    id: it.id,
    imageUrl: it.imageUrl,
    mobileImageUrl: it.mobileImageUrl ?? '',
    href: it.href?.trim() || HERO_SLIDE_HREF_DEFAULT,
    plaque: normalizeHeroPlaque(it.plaque),
    active: it.active,
  };
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await adminBackendFetch('catalog/admin/upload-rich-media?type=image', {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    throw new AdminBackendRequestError(await readAdminApiError(res), res.status);
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error('Сервер не вернул URL изображения');
  }
  return normalizeUploadUrl(data.url);
}

function ImageUploadField({
  label,
  url,
  disabled,
  emptyHint,
  thumbClassName,
  onUrlChange,
  onUpload,
  onClear,
}: {
  label: string;
  url: string;
  disabled: boolean;
  emptyHint: string;
  thumbClassName?: string;
  onUrlChange: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = toRelativeMediaPath(url);

  return (
    <div className={styles.heroImageCol}>
      <p className={styles.heroImageLabel}>{label}</p>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={thumbClassName || styles.heroThumb} src={preview} alt="" />
      ) : (
        <p className={catalogStyles.lead}>{emptyHint}</p>
      )}
      <input
        type="text"
        className={styles.heroTextInput}
        value={url}
        disabled={disabled}
        placeholder="/uploads/… или /images/…"
        onChange={(e) => onUrlChange(e.target.value)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className={styles.heroFileInput}
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUpload(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <AdminCompactBtn
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          Загрузить
        </AdminCompactBtn>
        {url ? (
          <AdminCompactBtn type="button" variant="outline" disabled={disabled} onClick={onClear}>
            Убрать
          </AdminCompactBtn>
        ) : null}
      </div>
    </div>
  );
}

/** Мини-превью как на главной: баннер + плашка снизу. */
function SlideHomePreview({ item }: { item: SlideDraft }) {
  const cover = toRelativeMediaPath(item.imageUrl) || toRelativeMediaPath(item.mobileImageUrl);
  const plaque = item.plaque;
  const plaqueImg = plaque ? toRelativeMediaPath(plaque.imageUrl) : '';
  const titleLines = plaque ? heroPlaqueTitleLines(plaque.title) : (['Заголовок'] as [string]);

  return (
    <div className={styles.heroSlidePreview} aria-hidden={!cover}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.heroSlidePreviewBg} src={cover} alt="" />
      ) : (
        <div className={styles.heroSlidePreviewEmpty}>Нет обложки слайда</div>
      )}
      {plaque ? (
        <div className={styles.heroPlaquePreview}>
          {plaqueImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.heroPlaquePreviewThumb} src={plaqueImg} alt="" />
          ) : (
            <div className={styles.heroPlaquePreviewThumbEmpty} />
          )}
          <div className={styles.heroPlaquePreviewText}>
            <p className={styles.heroPlaquePreviewTitle}>
              {titleLines[0] || 'Заголовок'}
              {titleLines[1] ? (
                <>
                  <br />
                  {titleLines[1]}
                </>
              ) : null}
            </p>
            <p className={styles.heroPlaquePreviewSub}>
              {plaque.subtitle.trim() || 'Подзаголовок'}
            </p>
          </div>
        </div>
      ) : (
        <p className={styles.heroSlidePreviewHint}>Без плашки</p>
      )}
    </div>
  );
}

function SortableHeroRow({
  item,
  index,
  disabled,
  template,
  onChange,
  onRemove,
  onUploadMain,
  onUploadPlaque,
}: {
  item: SlideDraft;
  index: number;
  disabled: boolean;
  template: HeroPlaqueTemplate;
  onChange: (patch: Partial<SlideDraft>) => void;
  onRemove: () => void;
  onUploadMain: (field: 'imageUrl' | 'mobileImageUrl', file: File) => Promise<void>;
  onUploadPlaque: (file: File) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled,
  });
  const hasPlaque = item.plaque != null;
  const plaque = item.plaque ?? emptyPlaque();
  const [plaqueOpen, setPlaqueOpen] = useState(hasPlaque);

  useEffect(() => {
    if (hasPlaque) setPlaqueOpen(true);
  }, [hasPlaque]);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`${styles.faqCard} ${isDragging ? styles.faqCardDragging : ''}`}
    >
      <div className={styles.faqCardHead}>
        <button
          type="button"
          className={styles.dragBtn}
          {...attributes}
          {...listeners}
          aria-label="Перетащить"
          disabled={disabled}
        >
          ⋮⋮
        </button>
        <span className={styles.heroImageLabel}>Слайд {index + 1}</span>
        <label className={styles.activeLabel}>
          <AdminCheckbox
            checked={item.active}
            onChange={(e) => onChange({ active: e.target.checked })}
            disabled={disabled}
          />
          Активен
        </label>
        <AdminCompactBtn
          type="button"
          variant="danger"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Удалить"
        >
          Удалить
        </AdminCompactBtn>
      </div>

      <div className={styles.heroSlideLayout}>
        <div className={styles.heroSlideFields}>
          <div className={styles.heroImages}>
            <ImageUploadField
              label="Десктоп"
              url={item.imageUrl}
              disabled={disabled}
              emptyHint="Не выбрано"
              onUrlChange={(imageUrl) => onChange({ imageUrl })}
              onUpload={(file) => onUploadMain('imageUrl', file)}
              onClear={() => onChange({ imageUrl: '' })}
            />
            <ImageUploadField
              label="Мобильная"
              url={item.mobileImageUrl}
              disabled={disabled}
              emptyHint="Как десктоп"
              onUrlChange={(mobileImageUrl) => onChange({ mobileImageUrl })}
              onUpload={(file) => onUploadMain('mobileImageUrl', file)}
              onClear={() => onChange({ mobileImageUrl: '' })}
            />
          </div>
          <label className={styles.heroImageCol}>
            <span className={styles.heroImageLabel}>Ссылка слайда</span>
            <input
              type="text"
              className={styles.heroTextInput}
              value={item.href}
              disabled={disabled}
              placeholder="/catalog/…"
              onChange={(e) => onChange({ href: e.target.value })}
            />
          </label>
        </div>
        <SlideHomePreview item={item} />
      </div>

      <div className={styles.heroPlaqueBar}>
        <label className={styles.activeLabel}>
          <AdminCheckbox
            checked={hasPlaque}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ plaque: emptyPlaque(template) });
                setPlaqueOpen(true);
              } else {
                onChange({ plaque: null });
                setPlaqueOpen(false);
              }
            }}
            disabled={disabled}
          />
          Плашка на слайде
        </label>
        {hasPlaque ? (
          <>
            <AdminCompactBtn
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setPlaqueOpen((v) => !v)}
            >
              {plaqueOpen ? 'Скрыть поля' : 'Поля плашки'}
            </AdminCompactBtn>
            <AdminCompactBtn
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange({ plaque: emptyPlaque(template) })}
            >
              Из шаблона
            </AdminCompactBtn>
          </>
        ) : null}
      </div>

      {hasPlaque && plaqueOpen ? (
        <div className={styles.heroPlaqueFields}>
          <ImageUploadField
            label="Обложка плашки"
            url={plaque.imageUrl}
            disabled={disabled}
            emptyHint="Обязательна"
            thumbClassName={styles.heroThumbSecondary}
            onUrlChange={(imageUrl) => onChange({ plaque: { ...plaque, imageUrl } })}
            onUpload={onUploadPlaque}
            onClear={() => onChange({ plaque: { ...plaque, imageUrl: '' } })}
          />
          <div className={styles.heroImageCol}>
            <label className={styles.heroImageCol}>
              <span className={styles.heroImageLabel}>Заголовок</span>
              <input
                type="text"
                className={styles.heroTextInput}
                value={plaque.title}
                disabled={disabled}
                onChange={(e) => onChange({ plaque: { ...plaque, title: e.target.value } })}
              />
            </label>
            <label className={styles.heroImageCol}>
              <span className={styles.heroImageLabel}>Подзаголовок</span>
              <textarea
                rows={2}
                className={styles.heroTextInput}
                value={plaque.subtitle}
                disabled={disabled}
                onChange={(e) => onChange({ plaque: { ...plaque, subtitle: e.target.value } })}
              />
            </label>
            <label className={styles.heroImageCol}>
              <span className={styles.heroImageLabel}>Ссылка плашки</span>
              <input
                type="text"
                className={styles.heroTextInput}
                value={plaque.href}
                disabled={disabled}
                placeholder="/catalog/…"
                onChange={(e) => onChange({ plaque: { ...plaque, href: e.target.value } })}
              />
            </label>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function HeroAdminClient({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { showToast } = useToast();
  const shell = useAdminSettingsListShell();
  const {
    loading,
    loadedOk,
    saving,
    loadError,
    actionError,
    beginLoad,
    succeedLoad,
    failLoad,
    beginSave,
    failSave,
    failAction,
    setActionError,
    setLoadError,
    setSaving,
  } = shell;

  const [tab, setTab] = useState<HeroTab>('slides');
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<SlideDraft[]>([]);
  const [template, setTemplate] = useState<HeroPlaqueTemplate>(TEMPLATE_DEFAULTS);
  /** Раздельный dirty: сохранение одной вкладки не маскирует другую */
  const [slidesDirty, setSlidesDirty] = useState(false);
  const [templateDirty, setTemplateDirty] = useState(false);

  const anyDirty = slidesDirty || templateDirty;

  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [anyDirty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    beginLoad();
    try {
      const [hero, sec] = await Promise.all([
        adminBackendJson<{ items: HeroSlideAdmin[] }>('settings/admin/hero'),
        adminBackendJson<HeroPlaqueTemplate>('settings/admin/hero-plaque-template'),
      ]);
      setItems((hero.items ?? []).map(mapApiItem));
      setTemplate({
        title: sec.title?.trim() || TEMPLATE_DEFAULTS.title,
        subtitle: sec.subtitle?.trim() || TEMPLATE_DEFAULTS.subtitle,
        imageUrl: sec.imageUrl?.trim() || TEMPLATE_DEFAULTS.imageUrl,
        href: sec.href?.trim() || TEMPLATE_DEFAULTS.href,
      });
      setSlidesDirty(false);
      setTemplateDirty(false);
      succeedLoad();
    } catch (e) {
      setItems([]);
      failLoad(e);
    }
  }, [beginLoad, succeedLoad, failLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.key === active.id);
      const newIndex = prev.findIndex((i) => i.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      setSlidesDirty(true);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function onUploadMain(
    key: string,
    field: 'imageUrl' | 'mobileImageUrl',
    file: File,
  ) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      setSlidesDirty(true);
      setItems((prev) =>
        prev.map((row) => (row.key === key ? { ...row, [field]: url } : row)),
      );
      showToast('Обложка загружена');
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки обложки'));
    } finally {
      setUploading(false);
    }
  }

  async function onUploadPlaque(key: string, file: File) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      setSlidesDirty(true);
      setItems((prev) =>
        prev.map((row) => {
          if (row.key !== key) return row;
          const plaque = row.plaque ?? emptyPlaque(template);
          return { ...row, plaque: { ...plaque, imageUrl: url } };
        }),
      );
      showToast('Обложка загружена');
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки обложки'));
    } finally {
      setUploading(false);
    }
  }

  async function onUploadTemplate(file: File) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      setTemplateDirty(true);
      setTemplate((prev) => ({ ...prev, imageUrl: url }));
      showToast('Обложка загружена');
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки обложки'));
    } finally {
      setUploading(false);
    }
  }

  function fillEmptyFromTemplate() {
    const t = emptyPlaque(template);
    if (!t.title || !t.subtitle || !t.imageUrl) {
      showToast('Сначала заполните шаблон (заголовок, текст, обложка)');
      return;
    }
    const emptyKeys = items.filter((row) => row.plaque == null).map((row) => row.key);
    if (emptyKeys.length === 0) {
      showToast('У всех слайдов уже есть плашка');
      return;
    }
    setSlidesDirty(true);
    setItems((prev) =>
      prev.map((row) => (row.plaque != null ? row : { ...row, plaque: { ...t } })),
    );
    showToast(`Заполнено слайдов: ${emptyKeys.length}. Не забудьте сохранить слайды.`);
    setTab('slides');
  }

  async function onSaveSlides(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;

    const incomplete = items.filter((it) => !it.imageUrl.trim());
    if (incomplete.length > 0) {
      showToast(
        incomplete.length === 1
          ? 'Добавьте десктоп-обложку или удалите пустой слайд'
          : `Есть слайды без обложки (${incomplete.length})`,
      );
      return;
    }

    let payloadItems: Array<{
      id?: string;
      imageUrl: string;
      mobileImageUrl: string | null;
      href: string;
      plaque: HeroPlaque | null;
      active: boolean;
    }>;
    try {
      payloadItems = items.map((it, i) => ({
        ...(it.id ? { id: it.id } : {}),
        imageUrl: it.imageUrl.trim(),
        mobileImageUrl: it.mobileImageUrl.trim() || null,
        href: it.href.trim() || HERO_SLIDE_HREF_DEFAULT,
        plaque: assertHeroPlaqueComplete(it.plaque, `Слайд #${i + 1}`),
        active: it.active,
      }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Проверьте плашки');
      return;
    }

    beginSave();
    try {
      const data = await adminBackendJson<{ items: HeroSlideAdmin[] }>('settings/admin/hero', {
        method: 'PUT',
        body: JSON.stringify({ items: payloadItems }),
      });
      setItems((data.items ?? []).map(mapApiItem));
      setSlidesDirty(false);
      setSaving(false);
      showToast('Слайды сохранены');
      const lag = homeRevalidateLagToast(await revalidateHomeStorefront());
      if (lag) showToast(lag);
    } catch (err) {
      showToast(failSave(err));
    }
  }

  async function onSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;
    const title = template.title.trim();
    const subtitle = template.subtitle.trim();
    const imageUrl = template.imageUrl.trim();
    const href = template.href.trim() || TEMPLATE_DEFAULTS.href;
    if (!title || !subtitle || !imageUrl) {
      showToast('Заполните заголовок, подзаголовок и картинку шаблона');
      return;
    }

    beginSave();
    try {
      const data = await adminBackendJson<HeroPlaqueTemplate>('settings/admin/hero-plaque-template', {
        method: 'PUT',
        body: JSON.stringify({ title, subtitle, imageUrl, href }),
      });
      setTemplate({
        title: data.title,
        subtitle: data.subtitle,
        imageUrl: data.imageUrl,
        href: data.href || TEMPLATE_DEFAULTS.href,
      });
      setTemplateDirty(false);
      setSaving(false);
      showToast('Шаблон плашки сохранён');
    } catch (err) {
      showToast(failSave(err));
    }
  }

  const canEdit = loadedOk && !loading && !uploading;
  const canSaveSlides = canEdit && slidesDirty && !saving;
  const canSaveTemplate = canEdit && templateDirty && !saving;
  const emptyPlaqueCount = items.filter((i) => i.plaque == null).length;

  return (
    <div>
      {!embedded ? <h1 className={catalogStyles.title}>Hero</h1> : null}
      <p className={catalogStyles.lead}>
        Слайд + плашка поверх него. Шаблон — только для «Из шаблона» / «Заполнить пустые» в
        админке; на витрину сам не подмешивается.
      </p>

      <AdminTabs
        ariaLabel="Разделы Hero"
        activeId={tab}
        onChange={setTab}
        items={[
          {
            id: 'slides' as const,
            label: slidesDirty ? 'Слайды •' : 'Слайды',
          },
          {
            id: 'template' as const,
            label: templateDirty ? 'Шаблон плашки •' : 'Шаблон плашки',
          },
        ]}
      />

      <AdminSettingsListErrors
        loadError={loadError}
        actionError={actionError}
        onRetry={() => void load()}
        onDismissLoad={() => setLoadError(null)}
        onDismissAction={() => setActionError(null)}
      />

      {loading ? (
        <p className={catalogStyles.lead}>Загрузка…</p>
      ) : !loadedOk ? (
        <p className={catalogStyles.lead}>
          Не удалось загрузить Hero. Нажмите «Повторить» — сохранение отключено, чтобы не стереть
          данные.
        </p>
      ) : tab === 'slides' ? (
        <AdminTabsPanel>
          <form
            onSubmit={(e) => void onSaveSlides(e)}
            className={`${catalogStyles.form} ${catalogStyles.formWide}`}
          >
            {slidesDirty ? (
              <p className={catalogStyles.lead}>Несохранённые изменения слайдов</p>
            ) : null}
            {templateDirty ? (
              <p className={catalogStyles.lead}>
                Есть несохранённый шаблон — сохраните на вкладке «Шаблон плашки».
              </p>
            ) : null}
            {uploading ? <p className={catalogStyles.lead}>Загрузка изображения…</p> : null}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={items.map((i) => i.key)}
                strategy={verticalListSortingStrategy}
              >
                <ul className={styles.faqList}>
                  {items.map((item, index) => (
                    <SortableHeroRow
                      key={item.key}
                      item={item}
                      index={index}
                      template={template}
                      disabled={saving || uploading}
                      onChange={(patch) => {
                        setSlidesDirty(true);
                        setItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                        );
                      }}
                      onRemove={() => {
                        setSlidesDirty(true);
                        setItems((prev) => prev.filter((_, i) => i !== index));
                      }}
                      onUploadMain={(field, file) => onUploadMain(item.key, field, file)}
                      onUploadPlaque={(file) => onUploadPlaque(item.key, file)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {items.length === 0 ? (
              <p className={catalogStyles.lead}>Слайдов пока нет</p>
            ) : null}

            <div className={catalogStyles.formActions}>
              <AdminCompactBtn
                type="button"
                variant="outline"
                disabled={saving || uploading}
                onClick={() => {
                  setSlidesDirty(true);
                  setItems((prev) => [
                    ...prev,
                    {
                      key: newKey(),
                      imageUrl: '',
                      mobileImageUrl: '',
                      href: HERO_SLIDE_HREF_DEFAULT,
                      plaque: null,
                      active: true,
                    },
                  ]);
                }}
              >
                Добавить слайд
              </AdminCompactBtn>
              {emptyPlaqueCount > 0 ? (
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  disabled={saving || uploading}
                  onClick={fillEmptyFromTemplate}
                >
                  Заполнить пустые из шаблона ({emptyPlaqueCount})
                </AdminCompactBtn>
              ) : null}
              <AdminCompactBtn type="submit" variant="accent" disabled={!canSaveSlides}>
                {saving ? 'Сохранение…' : 'Сохранить слайды'}
              </AdminCompactBtn>
            </div>
          </form>
        </AdminTabsPanel>
      ) : (
        <AdminTabsPanel>
          <form
            onSubmit={(e) => void onSaveTemplate(e)}
            className={`${catalogStyles.form} ${catalogStyles.formWide}`}
          >
            <p className={catalogStyles.lead}>
              Шаблон копируется в слайды только по кнопке. После миграции пустые слайды уже получили
              копию — витрина берёт плашку только из сохранённого слайда.
            </p>
            {templateDirty ? (
              <p className={catalogStyles.lead}>Несохранённые изменения шаблона</p>
            ) : null}
            {slidesDirty ? (
              <p className={catalogStyles.lead}>
                Есть несохранённые слайды — сохраните на вкладке «Слайды».
              </p>
            ) : null}
            {uploading ? <p className={catalogStyles.lead}>Загрузка изображения…</p> : null}

            <div className={styles.faqCard}>
              <label className={styles.heroImageCol}>
                <span className={styles.heroImageLabel}>Заголовок</span>
                <input
                  type="text"
                  className={styles.heroTextInput}
                  value={template.title}
                  disabled={saving || uploading}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setTemplate((prev) => ({ ...prev, title: e.target.value }));
                  }}
                />
              </label>

              <label className={styles.heroImageCol}>
                <span className={styles.heroImageLabel}>Подзаголовок</span>
                <textarea
                  rows={3}
                  className={styles.heroTextInput}
                  value={template.subtitle}
                  disabled={saving || uploading}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setTemplate((prev) => ({ ...prev, subtitle: e.target.value }));
                  }}
                />
              </label>

              <label className={styles.heroImageCol}>
                <span className={styles.heroImageLabel}>Ссылка плашки</span>
                <input
                  type="text"
                  className={styles.heroTextInput}
                  value={template.href}
                  disabled={saving || uploading}
                  placeholder="/catalog/…"
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setTemplate((prev) => ({ ...prev, href: e.target.value }));
                  }}
                />
              </label>
            </div>

            <div className={styles.heroImages}>
              <ImageUploadField
                label="Обложка шаблона"
                url={template.imageUrl}
                disabled={saving || uploading}
                emptyHint="Не выбрано"
                thumbClassName={styles.heroThumbSecondary}
                onUrlChange={(imageUrl) => {
                  setTemplateDirty(true);
                  setTemplate((prev) => ({ ...prev, imageUrl }));
                }}
                onUpload={onUploadTemplate}
                onClear={() => {
                  setTemplateDirty(true);
                  setTemplate((prev) => ({ ...prev, imageUrl: '' }));
                }}
              />
            </div>

            <div className={catalogStyles.formActions}>
              <AdminCompactBtn
                type="button"
                variant="outline"
                disabled={saving || uploading || emptyPlaqueCount === 0}
                onClick={fillEmptyFromTemplate}
              >
                Заполнить пустые слайды ({emptyPlaqueCount})
              </AdminCompactBtn>
              <AdminCompactBtn type="submit" variant="accent" disabled={!canSaveTemplate}>
                {saving ? 'Сохранение…' : 'Сохранить шаблон'}
              </AdminCompactBtn>
            </div>
          </form>
        </AdminTabsPanel>
      )}
    </div>
  );
}
