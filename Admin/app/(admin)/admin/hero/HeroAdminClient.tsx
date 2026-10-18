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
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminSettingsListErrors } from '@/components/admin/AdminSettingsListErrors/AdminSettingsListErrors';
import { AdminTabs, AdminTabsPanel } from '@/components/AdminTabs/AdminTabs';
import { useToast } from '@/components/Toast/ToastProvider';
import { adminBackendFetch, adminBackendJson } from '@/lib/adminBackendFetch';
import { useAdminSettingsListShell } from '@/lib/useAdminSettingsListShell';
import { revalidateHomeStorefront } from '@/lib/revalidateHomeStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from '@/app/(admin)/admin/settings/Settings.module.css';

type HeroTab = 'main' | 'secondary';

type HeroDraft = {
  key: string;
  id?: string;
  imageUrl: string;
  mobileImageUrl: string;
  href: string;
  active: boolean;
};

type HeroApiItem = {
  id: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  href?: string | null;
  sortOrder: number;
  active: boolean;
};

const MAIN_HREF_DEFAULT = '/catalog';

type SecondaryDraft = {
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
};

const SECONDARY_DEFAULTS: SecondaryDraft = {
  title: 'Аромат, что остаётся. История, что звучит в памяти',
  subtitle: 'Каждый аромат — это история, сотканная из чувств, мгновений и памяти.',
  imageUrl: '/images/hero-badge.png',
  href: '/catalog/aroma/teplichka-u-babuli',
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await adminBackendFetch('catalog/admin/upload-rich-media?type=image', {
    method: 'POST',
    body: fd,
  });
  const data = (await res.json()) as { url?: string };
  if (!res.ok || !data.url) {
    throw new Error('Не удалось загрузить изображение');
  }
  return data.url;
}

function SortableHeroRow({
  item,
  disabled,
  onChange,
  onRemove,
  onUpload,
}: {
  item: HeroDraft;
  disabled: boolean;
  onChange: (patch: Partial<HeroDraft>) => void;
  onRemove: () => void;
  onUpload: (field: 'imageUrl' | 'mobileImageUrl', file: File) => Promise<void>;
}) {
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled,
  });

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

      <div className={styles.heroImages}>
        <div className={styles.heroImageCol}>
          <p className={styles.heroImageLabel}>Десктоп</p>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.heroThumb} src={item.imageUrl} alt="" />
          ) : (
            <p className={catalogStyles.lead}>Не выбрано</p>
          )}
          <input
            ref={desktopRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.heroFileInput}
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload('imageUrl', f);
              if (desktopRef.current) desktopRef.current.value = '';
            }}
          />
          {item.imageUrl ? (
            <AdminCompactBtn
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange({ imageUrl: '' })}
            >
              Убрать
            </AdminCompactBtn>
          ) : null}
        </div>

        <div className={styles.heroImageCol}>
          <p className={styles.heroImageLabel}>Мобильная (опционально)</p>
          {item.mobileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.heroThumb} src={item.mobileImageUrl} alt="" />
          ) : (
            <p className={catalogStyles.lead}>Как десктоп</p>
          )}
          <input
            ref={mobileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.heroFileInput}
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload('mobileImageUrl', f);
              if (mobileRef.current) mobileRef.current.value = '';
            }}
          />
          {item.mobileImageUrl ? (
            <AdminCompactBtn
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange({ mobileImageUrl: '' })}
            >
              Убрать
            </AdminCompactBtn>
          ) : null}
        </div>
      </div>

      <label className={styles.heroImageCol}>
        <span className={styles.heroImageLabel}>Ссылка баннера</span>
        <input
          type="text"
          className={styles.heroTextInput}
          value={item.href}
          disabled={disabled}
          placeholder="/catalog/…"
          onChange={(e) => onChange({ href: e.target.value })}
        />
      </label>
    </li>
  );
}

export function HeroAdminClient({
  embedded = false,
}: {
  /** Без собственного h1 — для встраивания (legacy). */
  embedded?: boolean;
} = {}) {
  const { showToast } = useToast();
  const shell = useAdminSettingsListShell();
  const {
    loading,
    loadedOk,
    saving,
    dirty,
    loadError,
    actionError,
    markDirty,
    beginLoad,
    succeedLoad,
    failLoad,
    beginSave,
    succeedSave,
    failSave,
    failAction,
    setActionError,
    setLoadError,
  } = shell;
  const [tab, setTab] = useState<HeroTab>('main');
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<HeroDraft[]>([]);
  const [secondary, setSecondary] = useState<SecondaryDraft>(SECONDARY_DEFAULTS);
  const secondaryFileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    beginLoad();
    try {
      const [hero, sec] = await Promise.all([
        adminBackendJson<{ items: HeroApiItem[] }>('settings/admin/hero'),
        adminBackendJson<SecondaryDraft>('settings/admin/hero-secondary'),
      ]);
      setItems(
        (hero.items ?? []).map((it) => ({
          key: it.id,
          id: it.id,
          imageUrl: it.imageUrl,
          mobileImageUrl: it.mobileImageUrl ?? '',
          href: it.href?.trim() || MAIN_HREF_DEFAULT,
          active: it.active,
        })),
      );
      setSecondary({
        title: sec.title?.trim() || SECONDARY_DEFAULTS.title,
        subtitle: sec.subtitle?.trim() || SECONDARY_DEFAULTS.subtitle,
        imageUrl: sec.imageUrl?.trim() || SECONDARY_DEFAULTS.imageUrl,
        href: sec.href?.trim() || SECONDARY_DEFAULTS.href,
      });
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
      markDirty();
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function onUpload(key: string, field: 'imageUrl' | 'mobileImageUrl', file: File) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      markDirty();
      setItems((prev) =>
        prev.map((row) => (row.key === key ? { ...row, [field]: url } : row)),
      );
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки'));
    } finally {
      setUploading(false);
    }
  }

  async function onUploadSecondary(file: File) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      markDirty();
      setSecondary((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки'));
    } finally {
      setUploading(false);
    }
  }

  async function onSaveMain(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;

    const incomplete = items.filter((it) => !it.imageUrl.trim());
    if (incomplete.length > 0) {
      showToast(
        incomplete.length === 1
          ? 'Добавьте десктоп-картинку или удалите пустой слайд'
          : `Есть слайды без картинки (${incomplete.length})`,
      );
      return;
    }

    const payload = {
      items: items.map((it) => ({
        ...(it.id ? { id: it.id } : {}),
        imageUrl: it.imageUrl.trim(),
        mobileImageUrl: it.mobileImageUrl.trim() || null,
        href: it.href.trim() || MAIN_HREF_DEFAULT,
        active: it.active,
      })),
    };

    beginSave();
    try {
      const data = await adminBackendJson<{ items: HeroApiItem[] }>('settings/admin/hero', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setItems(
        (data.items ?? []).map((it) => ({
          key: it.id,
          id: it.id,
          imageUrl: it.imageUrl,
          mobileImageUrl: it.mobileImageUrl ?? '',
          href: it.href?.trim() || MAIN_HREF_DEFAULT,
          active: it.active,
        })),
      );
      succeedSave();
      showToast('Основной Hero сохранён');
      const revalidated = await revalidateHomeStorefront();
      if (!revalidated) {
        showToast('Сохранено, но кэш витрины не обновился — обновите главную вручную');
      }
    } catch (err) {
      showToast(failSave(err));
    }
  }

  async function onSaveSecondary(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;
    const title = secondary.title.trim();
    const subtitle = secondary.subtitle.trim();
    const imageUrl = secondary.imageUrl.trim();
    const href = secondary.href.trim() || SECONDARY_DEFAULTS.href;
    if (!title || !subtitle || !imageUrl) {
      showToast('Заполните заголовок, подзаголовок и картинку');
      return;
    }

    beginSave();
    try {
      const data = await adminBackendJson<SecondaryDraft>('settings/admin/hero-secondary', {
        method: 'PUT',
        body: JSON.stringify({ title, subtitle, imageUrl, href }),
      });
      setSecondary({
        title: data.title,
        subtitle: data.subtitle,
        imageUrl: data.imageUrl,
        href: data.href || SECONDARY_DEFAULTS.href,
      });
      succeedSave();
      showToast('Дополнительный баннер сохранён');
      const revalidated = await revalidateHomeStorefront();
      if (!revalidated) {
        showToast('Сохранено, но кэш витрины не обновился — обновите главную вручную');
      }
    } catch (err) {
      showToast(failSave(err));
    }
  }

  const canEdit = loadedOk && !loading && !uploading;
  const canSave = canEdit && dirty && !saving;

  return (
    <div>
      {!embedded ? <h1 className={catalogStyles.title}>Hero</h1> : null}
      <p className={catalogStyles.lead}>
        Основной — слайдер на главной (картинки + ссылка клика). Дополнительный — нижняя плашка
        (заголовок, текст, картинка, ссылка).
      </p>

      <AdminTabs
        ariaLabel="Разделы Hero"
        activeId={tab}
        onChange={setTab}
        items={[
          { id: 'main' as const, label: 'Основной' },
          { id: 'secondary' as const, label: 'Дополнительный' },
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
      ) : tab === 'main' ? (
        <AdminTabsPanel>
          <form
            onSubmit={(e) => void onSaveMain(e)}
            className={`${catalogStyles.form} ${catalogStyles.formWide}`}
          >
            {dirty ? <p className={catalogStyles.lead}>Несохранённые изменения</p> : null}
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
                      disabled={saving || uploading}
                      onChange={(patch) => {
                        markDirty();
                        setItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                        );
                      }}
                      onRemove={() => {
                        markDirty();
                        setItems((prev) => prev.filter((_, i) => i !== index));
                      }}
                      onUpload={(field, file) => onUpload(item.key, field, file)}
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
                  markDirty();
                  setItems((prev) => [
                    ...prev,
                    {
                      key: newKey(),
                      imageUrl: '',
                      mobileImageUrl: '',
                      href: MAIN_HREF_DEFAULT,
                      active: true,
                    },
                  ]);
                }}
              >
                Добавить слайд
              </AdminCompactBtn>
              <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </AdminCompactBtn>
            </div>
          </form>
        </AdminTabsPanel>
      ) : (
        <AdminTabsPanel>
          <form
            onSubmit={(e) => void onSaveSecondary(e)}
            className={`${catalogStyles.form} ${catalogStyles.formWide}`}
          >
            {dirty ? <p className={catalogStyles.lead}>Несохранённые изменения</p> : null}
            {uploading ? <p className={catalogStyles.lead}>Загрузка изображения…</p> : null}

            <div className={styles.faqCard}>
              <label className={styles.heroImageCol}>
                <span className={styles.heroImageLabel}>Заголовок</span>
                <input
                  type="text"
                  className={styles.heroTextInput}
                  value={secondary.title}
                  disabled={saving || uploading}
                  onChange={(e) => {
                    markDirty();
                    setSecondary((prev) => ({ ...prev, title: e.target.value }));
                  }}
                />
              </label>

              <label className={styles.heroImageCol}>
                <span className={styles.heroImageLabel}>Подзаголовок</span>
                <textarea
                  rows={3}
                  className={styles.heroTextInput}
                  value={secondary.subtitle}
                  disabled={saving || uploading}
                  onChange={(e) => {
                    markDirty();
                    setSecondary((prev) => ({ ...prev, subtitle: e.target.value }));
                  }}
                />
              </label>

              <label className={styles.heroImageCol}>
                <span className={styles.heroImageLabel}>Ссылка плашки</span>
                <input
                  type="text"
                  className={styles.heroTextInput}
                  value={secondary.href}
                  disabled={saving || uploading}
                  placeholder="/catalog/…"
                  onChange={(e) => {
                    markDirty();
                    setSecondary((prev) => ({ ...prev, href: e.target.value }));
                  }}
                />
              </label>
            </div>

            <div className={styles.heroImages}>
              <div className={styles.heroImageCol}>
                <p className={styles.heroImageLabel}>Картинка плашки</p>
                {secondary.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.heroThumbSecondary}
                    src={secondary.imageUrl}
                    alt=""
                  />
                ) : (
                  <p className={catalogStyles.lead}>Не выбрано</p>
                )}
                <input
                  ref={secondaryFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className={styles.heroFileInput}
                  disabled={saving || uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadSecondary(f);
                    if (secondaryFileRef.current) secondaryFileRef.current.value = '';
                  }}
                />
              </div>
            </div>

            <div className={catalogStyles.formActions}>
              <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </AdminCompactBtn>
            </div>
          </form>
        </AdminTabsPanel>
      )}
    </div>
  );
}
