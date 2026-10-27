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
import { UNPACKING_VIDEO_MAX_MB } from '@vspomni/catalog-constants';
import { toRelativeMediaPath } from '@vspomni/media-path';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminProductPickerModal } from '@/components/admin/AdminProductPickerModal';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminSettingsListErrors } from '@/components/admin/AdminSettingsListErrors/AdminSettingsListErrors';
import { AdminTextField } from '@/components/AdminTextField/AdminTextField';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminBackendJson,
  adminBackendPath,
} from '@/lib/adminBackendFetch';
import { useAdminSettingsListShell } from '@/lib/useAdminSettingsListShell';
import {
  homeRevalidateLagToast,
  revalidateHomeStorefront,
} from '@/lib/revalidateHomeStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from '@/app/(admin)/admin/settings/Settings.module.css';
import { UnpackingReelPreview } from './UnpackingReelPreview';

const UNPACKING_VIDEO_MAX_BYTES = UNPACKING_VIDEO_MAX_MB * 1024 * 1024;

type UnpackingDraft = {
  key: string;
  id?: string;
  videoUrl: string;
  posterUrl: string;
  videoFile: File | null;
  posterFile: File | null;
  videoObjectUrl: string | null;
  posterObjectUrl: string | null;
  captionName: string;
  captionDate: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  productPrice: number | null;
  active: boolean;
};

type UnpackingApiItem = {
  id: string;
  videoUrl: string;
  posterUrl: string;
  captionName: string;
  captionDate: string | null;
  productId: string;
  sortOrder: number;
  active: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    price?: number | null;
  };
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyDraft(): UnpackingDraft {
  return {
    key: newKey(),
    videoUrl: '',
    posterUrl: '',
    videoFile: null,
    posterFile: null,
    videoObjectUrl: null,
    posterObjectUrl: null,
    captionName: '',
    captionDate: '',
    productId: '',
    productName: '',
    productImageUrl: '',
    productPrice: null,
    active: true,
  };
}

function relMedia(url: string | null | undefined): string {
  const t = (url ?? '').trim();
  if (!t) return '';
  return toRelativeMediaPath(t) || t;
}

function apiItemToDraft(it: UnpackingApiItem): UnpackingDraft {
  return {
    key: it.id,
    id: it.id,
    videoUrl: relMedia(it.videoUrl),
    posterUrl: relMedia(it.posterUrl),
    videoFile: null,
    posterFile: null,
    videoObjectUrl: null,
    posterObjectUrl: null,
    captionName: it.captionName ?? '',
    captionDate: it.captionDate ?? '',
    productId: it.productId,
    productName: it.product?.name ?? '',
    productImageUrl: relMedia(it.product?.imageUrl),
    productPrice:
      typeof it.product?.price === 'number' ? it.product.price : null,
    active: it.active,
  };
}

function revokeObjectUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

function revokeDraftMedia(row: UnpackingDraft) {
  revokeObjectUrl(row.videoObjectUrl);
  revokeObjectUrl(row.posterObjectUrl);
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|mov|m4v|webm)$/i.test(file.name);
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** Upload с прогрессом; purpose=unpacking → серверный потолок 20 МБ. */
function uploadMediaWithProgress(
  file: File,
  kind: 'image' | 'video',
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const qs =
      kind === 'video'
        ? `type=video&purpose=unpacking`
        : `type=image&purpose=unpacking`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', adminBackendPath(`catalog/admin/upload-rich-media?${qs}`));
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      let data: { url?: string; message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}') as typeof data;
      } catch {
        /* ignore */
      }
      if (xhr.status < 200 || xhr.status >= 300 || !data.url) {
        reject(
          new Error(
            data.message ||
              (kind === 'video'
                ? `Не удалось загрузить видео (MP4/MOV, до ${UNPACKING_VIDEO_MAX_MB} МБ)`
                : 'Не удалось загрузить постер'),
          ),
        );
        return;
      }
      resolve(relMedia(data.url));
    };
    xhr.onerror = () => reject(new Error('Сеть: не удалось загрузить файл'));
    xhr.send(fd);
  });
}

/**
 * Best-effort GC orphan URL (upload без PUT).
 * pagehide/beforeunload → sendBeacon; иначе keepalive fetch.
 */
function discardUnpackingUploads(
  urls: string[],
  opts?: { preferBeacon?: boolean },
) {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) return;
  const path = adminBackendPath('settings/admin/unpacking/discard-uploads');
  const body = JSON.stringify({ urls: unique });
  if (
    opts?.preferBeacon &&
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(path, blob)) return;
    } catch {
      /* fall through */
    }
  }
  try {
    void fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

function SortableUnpackingRow({
  item,
  disabled,
  onChange,
  onRemove,
  onPickVideo,
  onPickPoster,
  onClearVideo,
  onClearPoster,
  onPickProduct,
}: {
  item: UnpackingDraft;
  disabled: boolean;
  onChange: (patch: Partial<UnpackingDraft>) => void;
  onRemove: () => void;
  onPickVideo: (file: File) => void;
  onPickPoster: (file: File) => void;
  onClearVideo: () => void;
  onClearPoster: () => void;
  onPickProduct: () => void;
}) {
  const videoRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key, disabled });

  const videoPreview =
    item.videoObjectUrl || (item.videoUrl ? relMedia(item.videoUrl) : '');
  const posterPreview =
    item.posterObjectUrl || (item.posterUrl ? relMedia(item.posterUrl) : '');

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(200px, 240px)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div>
          <div className={styles.heroImages}>
            <div className={styles.heroImageCol}>
              <p className={styles.heroImageLabel}>Видео (рилс)</p>
              {videoPreview ? (
                <video
                  src={videoPreview}
                  className={styles.heroThumb}
                  style={{ objectFit: 'cover' }}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <p className={catalogStyles.lead}>Не выбрано</p>
              )}
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
                className={styles.heroFileInput}
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickVideo(f);
                  if (videoRef.current) videoRef.current.value = '';
                }}
              />
              {videoPreview ? (
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={onClearVideo}
                >
                  Убрать видео
                </AdminCompactBtn>
              ) : null}
            </div>

            <div className={styles.heroImageCol}>
              <p className={styles.heroImageLabel}>Постер (обязательно)</p>
              {posterPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.heroThumb}
                  src={posterPreview}
                  alt=""
                />
              ) : (
                <p className={catalogStyles.lead}>Нужен для LCP</p>
              )}
              <input
                ref={posterRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className={styles.heroFileInput}
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickPoster(f);
                  if (posterRef.current) posterRef.current.value = '';
                }}
              />
              {posterPreview ? (
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={onClearPoster}
                >
                  Убрать постер
                </AdminCompactBtn>
              ) : null}
            </div>

            <div className={styles.heroImageCol}>
              <p className={styles.heroImageLabel}>Товар (плашка)</p>
              {item.productId ? (
                <p className={catalogStyles.lead}>
                  {item.productName || item.productId}
                </p>
              ) : (
                <p className={catalogStyles.lead}>Не выбран</p>
              )}
              <AdminCompactBtn
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={onPickProduct}
              >
                {item.productId ? 'Сменить товар' : 'Выбрать товар'}
              </AdminCompactBtn>
              {item.productId ? (
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      productId: '',
                      productName: '',
                      productImageUrl: '',
                      productPrice: null,
                    })
                  }
                >
                  Убрать
                </AdminCompactBtn>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 12,
            }}
          >
            <AdminTextField
              label="Подпись (имя)"
              value={item.captionName}
              onChange={(e) => onChange({ captionName: e.target.value })}
              maxLength={200}
              placeholder="Как у звезды в «Выбор»"
              disabled={disabled}
            />
            <AdminTextField
              label="Дата"
              type="date"
              value={item.captionDate}
              onChange={(e) => onChange({ captionDate: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>

        <UnpackingReelPreview
          productName={item.productName}
          price={item.productPrice}
          productImageUrl={item.productImageUrl || null}
          captionName={item.captionName}
          captionDate={item.captionDate}
          videoSrc={videoPreview || null}
          posterSrc={posterPreview || null}
        />
      </div>
    </li>
  );
}

export function UnpackingAdminClient() {
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
    setActionError,
    setLoadError,
  } = shell;
  const [items, setItems] = useState<UnpackingDraft[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /** URL, загруженные в текущем Save до успешного PUT — для beacon при закрытии вкладки. */
  const orphanUploadUrlsRef = useRef<string[]>([]);
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    return () => {
      for (const row of itemsRef.current) revokeDraftMedia(row);
    };
  }, []);

  useEffect(() => {
    const flushOrphans = () => {
      if (!orphanUploadUrlsRef.current.length) return;
      discardUnpackingUploads(orphanUploadUrlsRef.current, {
        preferBeacon: true,
      });
    };
    window.addEventListener('pagehide', flushOrphans);
    window.addEventListener('beforeunload', flushOrphans);
    return () => {
      window.removeEventListener('pagehide', flushOrphans);
      window.removeEventListener('beforeunload', flushOrphans);
    };
  }, []);

  const load = useCallback(async () => {
    beginLoad();
    try {
      const data = await adminBackendJson<{ items: UnpackingApiItem[] }>(
        'settings/admin/unpacking',
      );
      setItems((prev) => {
        for (const row of prev) revokeDraftMedia(row);
        return (data.items ?? []).map(apiItemToDraft);
      });
      succeedLoad();
    } catch (e) {
      setItems((prev) => {
        for (const row of prev) revokeDraftMedia(row);
        return [];
      });
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

  function patchItem(key: string, patch: Partial<UnpackingDraft>) {
    markDirty();
    setItems((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function pickVideo(key: string, file: File) {
    if (!isVideoFile(file)) {
      showToast('Нужен видеофайл (MP4/MOV)');
      return;
    }
    if (file.size > UNPACKING_VIDEO_MAX_BYTES) {
      showToast(
        `Файл ${formatMb(file.size)} МБ — для рилса максимум ${UNPACKING_VIDEO_MAX_MB} МБ (лучше ≤10–15 МБ, H.264, 15–20 с)`,
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(
        `Файл ${formatMb(file.size)} МБ — лучше сжать до ≤10–15 МБ (H.264, 15–20 с)`,
      );
    }
    markDirty();
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        revokeObjectUrl(row.videoObjectUrl);
        return {
          ...row,
          videoFile: file,
          videoObjectUrl: URL.createObjectURL(file),
        };
      }),
    );
  }

  function pickPoster(key: string, file: File) {
    markDirty();
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        revokeObjectUrl(row.posterObjectUrl);
        return {
          ...row,
          posterFile: file,
          posterObjectUrl: URL.createObjectURL(file),
        };
      }),
    );
  }

  function clearVideo(key: string) {
    markDirty();
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        revokeObjectUrl(row.videoObjectUrl);
        return {
          ...row,
          videoUrl: '',
          videoFile: null,
          videoObjectUrl: null,
        };
      }),
    );
  }

  function clearPoster(key: string) {
    markDirty();
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        revokeObjectUrl(row.posterObjectUrl);
        return {
          ...row,
          posterUrl: '',
          posterFile: null,
          posterObjectUrl: null,
        };
      }),
    );
  }

  function removeItem(key: string) {
    markDirty();
    setItems((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row) revokeDraftMedia(row);
      return prev.filter((r) => r.key !== key);
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;

    const incomplete = items.filter(
      (it) =>
        !(it.videoFile || it.videoUrl.trim()) ||
        !(it.posterFile || it.posterUrl.trim()) ||
        !it.productId.trim(),
    );
    if (incomplete.length > 0) {
      showToast(
        incomplete.length === 1
          ? 'Добавьте видео, постер и товар или удалите пустую строку'
          : `Есть неполные рилсы (${incomplete.length})`,
      );
      return;
    }

    beginSave();
    setUploadProgress(null);
    const uploadedThisSave: string[] = [];
    orphanUploadUrlsRef.current = [];
    try {
      const payloadItems: Array<{
        id?: string;
        videoUrl: string;
        posterUrl: string;
        captionName: string | null;
        captionDate: string | null;
        productId: string;
        active: boolean;
      }> = [];

      const videoUploads = items.filter((it) => it.videoFile).length;
      const posterUploads = items.filter((it) => it.posterFile).length;
      let doneVideos = 0;
      let donePosters = 0;

      for (const it of items) {
        let videoUrl = relMedia(it.videoUrl);
        let posterUrl = relMedia(it.posterUrl);
        if (it.videoFile) {
          const label = `Видео ${doneVideos + 1}/${videoUploads || 1}`;
          setUploadProgress(`${label} — 0%`);
          videoUrl = await uploadMediaWithProgress(it.videoFile, 'video', (pct) => {
            setUploadProgress(`${label} — ${pct}%`);
          });
          uploadedThisSave.push(videoUrl);
          orphanUploadUrlsRef.current = [...uploadedThisSave];
          doneVideos += 1;
        }
        if (it.posterFile) {
          const label = `Постер ${donePosters + 1}/${posterUploads || 1}`;
          setUploadProgress(`${label} — 0%`);
          posterUrl = await uploadMediaWithProgress(
            it.posterFile,
            'image',
            (pct) => {
              setUploadProgress(`${label} — ${pct}%`);
            },
          );
          uploadedThisSave.push(posterUrl);
          orphanUploadUrlsRef.current = [...uploadedThisSave];
          donePosters += 1;
        }
        payloadItems.push({
          ...(it.id ? { id: it.id } : {}),
          videoUrl,
          posterUrl,
          captionName: it.captionName.trim() || null,
          captionDate: it.captionDate.trim() || null,
          productId: it.productId.trim(),
          active: it.active,
        });
      }

      setUploadProgress('Сохранение…');
      const data = await adminBackendJson<{ items: UnpackingApiItem[] }>(
        'settings/admin/unpacking',
        {
          method: 'PUT',
          body: JSON.stringify({ items: payloadItems }),
        },
      );
      orphanUploadUrlsRef.current = [];
      setItems((prev) => {
        for (const row of prev) revokeDraftMedia(row);
        return (data.items ?? []).map(apiItemToDraft);
      });
      succeedSave();
      showToast('Распаковка сохранена');
      const lag = homeRevalidateLagToast(await revalidateHomeStorefront());
      if (lag) showToast(lag);
    } catch (err) {
      if (uploadedThisSave.length) {
        discardUnpackingUploads(uploadedThisSave);
      }
      orphanUploadUrlsRef.current = [];
      showToast(failSave(err));
    } finally {
      setUploadProgress(null);
    }
  }

  const pickerItem = pickerKey ? items.find((i) => i.key === pickerKey) : null;
  const canEdit = loadedOk && !loading && !saving;
  const canSave = canEdit && dirty;

  return (
    <div>
      <h1 className={catalogStyles.title}>Распаковка</h1>
      <p className={catalogStyles.lead}>
        Рилсы на главной — как «Выбор ⭐»: видео, постер (LCP), подпись и плашка
        товара. Файлы уходят на сервер при «Сохранить». Рекомендуем ролик
        ≤15–20 с, H.264/MP4, ≤10–{UNPACKING_VIDEO_MAX_MB} МБ.
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
          Не удалось загрузить. Нажмите «Повторить» — сохранение отключено.
        </p>
      ) : (
        <form
          onSubmit={(e) => void onSave(e)}
          className={`${catalogStyles.form} ${catalogStyles.formWide}`}
        >
          {dirty ? (
            <p className={catalogStyles.lead}>Несохранённые изменения</p>
          ) : null}
          {uploadProgress ? (
            <p className={catalogStyles.lead} aria-live="polite">
              {uploadProgress}
            </p>
          ) : saving ? (
            <p className={catalogStyles.lead}>Сохранение…</p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul className={styles.faqList}>
                {items.map((item) => (
                  <SortableUnpackingRow
                    key={item.key}
                    item={item}
                    disabled={saving}
                    onChange={(patch) => patchItem(item.key, patch)}
                    onRemove={() => removeItem(item.key)}
                    onPickVideo={(file) => pickVideo(item.key, file)}
                    onPickPoster={(file) => pickPoster(item.key, file)}
                    onClearVideo={() => clearVideo(item.key)}
                    onClearPoster={() => clearPoster(item.key)}
                    onPickProduct={() => {
                      setPickerKey(item.key);
                      setPickerOpen(true);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {items.length === 0 ? (
            <p className={catalogStyles.lead}>Рилсов пока нет</p>
          ) : null}

          <div className={catalogStyles.formActions}>
            <AdminCompactBtn
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                markDirty();
                setItems((prev) => [...prev, emptyDraft()]);
              }}
            >
              Добавить рилс
            </AdminCompactBtn>
            <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </AdminCompactBtn>
          </div>
        </form>
      )}

      <AdminProductPickerModal
        open={pickerOpen}
        single
        selectedIds={pickerItem?.productId ? [pickerItem.productId] : []}
        selectedLabels={
          pickerItem?.productId && pickerItem.productName
            ? { [pickerItem.productId]: pickerItem.productName }
            : {}
        }
        onClose={() => {
          setPickerOpen(false);
          setPickerKey(null);
        }}
        onApply={(ids, labels) => {
          const id = ids[0];
          if (!pickerKey) return;
          if (!id) {
            patchItem(pickerKey, {
              productId: '',
              productName: '',
              productImageUrl: '',
              productPrice: null,
            });
            setPickerOpen(false);
            setPickerKey(null);
            return;
          }
          const name = labels[id] ?? '';
          patchItem(pickerKey, {
            productId: id,
            productName: name,
          });
          setPickerOpen(false);
          setPickerKey(null);
          void (async () => {
            try {
              const p = await adminBackendJson<{
                name?: string;
                coverImageUrl?: string | null;
                variants?: Array<{ price?: number }>;
              }>(`catalog/admin/products/${id}`);
              patchItem(pickerKey, {
                productName: p.name?.trim() || name,
                productImageUrl: relMedia(p.coverImageUrl),
                productPrice:
                  typeof p.variants?.[0]?.price === 'number'
                    ? p.variants[0].price
                    : null,
              });
            } catch {
              /* имя из пикера уже есть */
            }
          })();
        }}
      />
    </div>
  );
}
