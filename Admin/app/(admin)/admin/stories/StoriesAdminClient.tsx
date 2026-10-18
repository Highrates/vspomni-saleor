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
import { useToast } from '@/components/Toast/ToastProvider';
import { adminBackendFetch, adminBackendJson } from '@/lib/adminBackendFetch';
import { useAdminSettingsListShell } from '@/lib/useAdminSettingsListShell';
import { revalidateHomeStorefront } from '@/lib/revalidateHomeStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from '@/app/(admin)/admin/settings/Settings.module.css';

type SlideDraft = {
  key: string;
  id?: string;
  url: string;
  mediaType: 'image' | 'video';
};

type StoryDraft = {
  key: string;
  id?: string;
  title: string;
  slug: string;
  coverUrl: string;
  active: boolean;
  slides: SlideDraft[];
  open: boolean;
};

type StoryApiItem = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  sortOrder: number;
  active: boolean;
  slides: { id: string; url: string; mediaType: string; sortOrder: number }[];
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function fromApi(items: StoryApiItem[], openKeys?: Set<string>): StoryDraft[] {
  return (items ?? []).map((it) => ({
    key: it.id,
    id: it.id,
    title: it.title,
    slug: it.slug,
    coverUrl: it.coverUrl ?? '',
    active: it.active,
    open: openKeys?.has(it.id) ?? false,
    slides: (it.slides ?? []).map((s) => ({
      key: s.id,
      id: s.id,
      url: s.url,
      mediaType: s.mediaType === 'video' ? 'video' : 'image',
    })),
  }));
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

function SlideRow({
  slide,
  index,
  total,
  disabled,
  onChange,
  onMove,
  onRemove,
  onUpload,
}: {
  slide: SlideDraft;
  index: number;
  total: number;
  disabled: boolean;
  onChange: (patch: Partial<SlideDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
      <span>{index + 1}.</span>
      {slide.url ? (
        slide.mediaType === 'video' ? (
          <video src={slide.url} style={{ width: 56, height: 100, objectFit: 'cover' }} muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.url}
            alt=""
            style={{ width: 56, height: 100, objectFit: 'cover', borderRadius: 4 }}
          />
        )
      ) : (
        <span style={{ width: 56 }}>—</span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <input
          type="text"
          value={slide.url}
          placeholder="URL картинки / видео"
          disabled={disabled}
          onChange={(e) => onChange({ url: e.target.value })}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={slide.mediaType}
            disabled={disabled}
            onChange={(e) =>
              onChange({ mediaType: e.target.value === 'video' ? 'video' : 'image' })
            }
          >
            <option value="image">Картинка</option>
            <option value="video">Видео (по URL)</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              if (fileRef.current) fileRef.current.value = '';
            }}
          />
        </div>
      </div>
      <AdminCompactBtn
        type="button"
        variant="outline"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        aria-label="Выше"
      >
        ↑
      </AdminCompactBtn>
      <AdminCompactBtn
        type="button"
        variant="outline"
        disabled={disabled || index === total - 1}
        onClick={() => onMove(1)}
        aria-label="Ниже"
      >
        ↓
      </AdminCompactBtn>
      <AdminCompactBtn type="button" variant="danger" disabled={disabled} onClick={onRemove}>
        Удалить
      </AdminCompactBtn>
    </li>
  );
}

function SortableStoryRow({
  item,
  disabled,
  onChange,
  onRemove,
  onUploadCover,
  onSlideChange,
  onSlideAdd,
  onSlideMove,
  onSlideRemove,
  onSlideUpload,
}: {
  item: StoryDraft;
  disabled: boolean;
  onChange: (patch: Partial<StoryDraft>) => void;
  onRemove: () => void;
  onUploadCover: (file: File) => Promise<void>;
  onSlideChange: (slideIdx: number, patch: Partial<SlideDraft>) => void;
  onSlideAdd: () => void;
  onSlideMove: (slideIdx: number, dir: -1 | 1) => void;
  onSlideRemove: (slideIdx: number) => void;
  onSlideUpload: (slideIdx: number, file: File) => Promise<void>;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled,
  });
  const preview = item.coverUrl || item.slides.find((s) => s.mediaType === 'image')?.url || '';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
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
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#ddd' }} />
        )}
        <label className={styles.activeLabel}>
          <AdminCheckbox
            checked={item.active}
            onChange={(e) => onChange({ active: e.target.checked })}
            disabled={disabled}
          />
          Активна
        </label>
        <AdminCompactBtn
          type="button"
          variant="outline"
          onClick={() => onChange({ open: !item.open })}
        >
          {item.open ? 'Свернуть' : `Слайды (${item.slides.length})`}
        </AdminCompactBtn>
        <AdminCompactBtn type="button" variant="danger" onClick={onRemove} disabled={disabled}>
          Удалить
        </AdminCompactBtn>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
        <input
          type="text"
          value={item.title}
          placeholder="Название"
          disabled={disabled}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <input
          type="text"
          value={item.slug}
          placeholder="slug (авто)"
          disabled={disabled}
          onChange={(e) => onChange({ slug: e.target.value })}
        />
        <input
          ref={coverRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUploadCover(f);
            if (coverRef.current) coverRef.current.value = '';
          }}
        />
        {item.coverUrl ? (
          <AdminCompactBtn
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange({ coverUrl: '' })}
          >
            Убрать обложку
          </AdminCompactBtn>
        ) : (
          <span className={catalogStyles.lead}>Обложка: первый слайд</span>
        )}
      </div>

      {item.open ? (
        <div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {item.slides.map((s, i) => (
              <SlideRow
                key={s.key}
                slide={s}
                index={i}
                total={item.slides.length}
                disabled={disabled}
                onChange={(patch) => onSlideChange(i, patch)}
                onMove={(dir) => onSlideMove(i, dir)}
                onRemove={() => onSlideRemove(i)}
                onUpload={(file) => onSlideUpload(i, file)}
              />
            ))}
          </ul>
          {item.slides.length === 0 ? <p className={catalogStyles.lead}>Слайдов нет</p> : null}
          <AdminCompactBtn type="button" variant="outline" disabled={disabled} onClick={onSlideAdd}>
            Добавить слайд
          </AdminCompactBtn>
        </div>
      ) : null}
    </li>
  );
}

export function StoriesAdminClient() {
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
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<StoryDraft[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    beginLoad();
    try {
      const data = await adminBackendJson<{ items: StoryApiItem[] }>('settings/admin/stories');
      setItems(fromApi(data.items));
      succeedLoad();
    } catch (e) {
      setItems([]);
      failLoad(e);
    }
  }, [beginLoad, succeedLoad, failLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchStory(index: number, patch: Partial<StoryDraft>) {
    // раскрытие/сворачивание не считается правкой
    if (!(Object.keys(patch).length === 1 && 'open' in patch)) markDirty();
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function patchSlides(index: number, fn: (slides: SlideDraft[]) => SlideDraft[]) {
    markDirty();
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, slides: fn(row.slides) } : row)),
    );
  }

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

  async function withUpload(file: File, apply: (url: string) => void) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      apply(url);
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки'));
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;

    if (items.some((it) => !it.title.trim())) {
      showToast('У каждой сторис должно быть название');
      return;
    }
    if (items.some((it) => it.slides.some((s) => !s.url.trim()))) {
      showToast('Есть слайды без файла — загрузите или удалите их');
      return;
    }

    const openKeys = new Set(items.filter((i) => i.open && i.id).map((i) => i.id!));
    const payload = {
      items: items.map((it) => ({
        ...(it.id ? { id: it.id } : {}),
        title: it.title.trim(),
        slug: it.slug.trim() || undefined,
        coverUrl: it.coverUrl.trim() || null,
        active: it.active,
        slides: it.slides.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          url: s.url.trim(),
          mediaType: s.mediaType,
        })),
      })),
    };

    beginSave();
    try {
      const data = await adminBackendJson<{ items: StoryApiItem[] }>('settings/admin/stories', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setItems(fromApi(data.items, openKeys));
      succeedSave();
      showToast('Сторис сохранены');
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
      <h1 className={catalogStyles.title}>Сторис</h1>
      <p className={catalogStyles.lead}>
        Круги на главной (как в Instagram): обложка, название и набор слайдов.
      </p>

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
          Не удалось загрузить сторис. Нажмите «Повторить» — сохранение отключено, чтобы не стереть
          данные.
        </p>
      ) : (
        <form
          onSubmit={(e) => void onSave(e)}
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
                  <SortableStoryRow
                    key={item.key}
                    item={item}
                    disabled={saving || uploading}
                    onChange={(patch) => patchStory(index, patch)}
                    onRemove={() => {
                      markDirty();
                      setItems((prev) => prev.filter((_, i) => i !== index));
                    }}
                    onUploadCover={(file) =>
                      withUpload(file, (url) => patchStory(index, { coverUrl: url }))
                    }
                    onSlideChange={(si, patch) =>
                      patchSlides(index, (sl) =>
                        sl.map((s, j) => (j === si ? { ...s, ...patch } : s)),
                      )
                    }
                    onSlideAdd={() =>
                      patchSlides(index, (sl) => [
                        ...sl,
                        { key: newKey(), url: '', mediaType: 'image' },
                      ])
                    }
                    onSlideMove={(si, dir) =>
                      patchSlides(index, (sl) => {
                        const to = si + dir;
                        return to < 0 || to >= sl.length ? sl : arrayMove(sl, si, to);
                      })
                    }
                    onSlideRemove={(si) => patchSlides(index, (sl) => sl.filter((_, j) => j !== si))}
                    onSlideUpload={(si, file) =>
                      withUpload(file, (url) =>
                        patchSlides(index, (sl) =>
                          sl.map((s, j) =>
                            j === si ? { ...s, url, mediaType: 'image' } : s,
                          ),
                        ),
                      )
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {items.length === 0 ? <p className={catalogStyles.lead}>Сторис пока нет</p> : null}

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
                    title: '',
                    slug: '',
                    coverUrl: '',
                    active: true,
                    slides: [],
                    open: true,
                  },
                ]);
              }}
            >
              Добавить сторис
            </AdminCompactBtn>
            <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </AdminCompactBtn>
          </div>
        </form>
      )}
    </div>
  );
}
