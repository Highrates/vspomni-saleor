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
import { DiscountProductPickerModal } from '@/app/(admin)/admin/discounts/DiscountScopePickerModal';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminSettingsListErrors } from '@/components/admin/AdminSettingsListErrors/AdminSettingsListErrors';
import { useToast } from '@/components/Toast/ToastProvider';
import { adminBackendFetch, adminBackendJson } from '@/lib/adminBackendFetch';
import { useAdminSettingsListShell } from '@/lib/useAdminSettingsListShell';
import { revalidateHomeStorefront } from '@/lib/revalidateHomeStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from '@/app/(admin)/admin/settings/Settings.module.css';

type HomepageSetDraft = {
  key: string;
  id?: string;
  imageUrl: string;
  productId: string;
  productName: string;
  active: boolean;
};

type HomepageSetApiItem = {
  id: string;
  imageUrl: string;
  productId: string;
  sortOrder: number;
  active: boolean;
  product: { id: string; name: string; slug: string };
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

function SortableHomepageSetRow({
  item,
  disabled,
  onChange,
  onRemove,
  onUpload,
  onPickProduct,
}: {
  item: HomepageSetDraft;
  disabled: boolean;
  onChange: (patch: Partial<HomepageSetDraft>) => void;
  onRemove: () => void;
  onUpload: (file: File) => Promise<void>;
  onPickProduct: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
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
          <p className={styles.heroImageLabel}>Картинка набора</p>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.heroThumb} src={item.imageUrl} alt="" />
          ) : (
            <p className={catalogStyles.lead}>Не выбрано</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.heroFileInput}
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              if (fileRef.current) fileRef.current.value = '';
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
          <p className={styles.heroImageLabel}>Товар</p>
          {item.productId ? (
            <p className={catalogStyles.lead}>{item.productName || item.productId}</p>
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
              onClick={() => onChange({ productId: '', productName: '' })}
            >
              Убрать
            </AdminCompactBtn>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function HomepageSetsAdminClient({
  embedded = false,
}: {
  /** Без собственного h1 / back — внутри hub с AdminTabs. */
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
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<HomepageSetDraft[]>([]);
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    beginLoad();
    try {
      const data = await adminBackendJson<{ items: HomepageSetApiItem[] }>(
        'settings/admin/homepage-sets',
      );
      setItems(
        (data.items ?? []).map((it) => ({
          key: it.id,
          id: it.id,
          imageUrl: it.imageUrl,
          productId: it.productId,
          productName: it.product?.name ?? '',
          active: it.active,
        })),
      );
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

  async function onUpload(key: string, file: File) {
    setUploading(true);
    setActionError(null);
    try {
      const url = await uploadImage(file);
      markDirty();
      setItems((prev) =>
        prev.map((row) => (row.key === key ? { ...row, imageUrl: url } : row)),
      );
    } catch (err) {
      showToast(failAction(err, 'Ошибка загрузки'));
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;

    const incomplete = items.filter((it) => !it.imageUrl.trim() || !it.productId.trim());
    if (incomplete.length > 0) {
      showToast(
        incomplete.length === 1
          ? 'Добавьте картинку и товар или удалите пустую строку'
          : `Есть неполные наборы (${incomplete.length})`,
      );
      return;
    }

    const productIds = items.map((it) => it.productId.trim());
    if (new Set(productIds).size !== productIds.length) {
      showToast('Один товар нельзя указать в двух наборах');
      return;
    }

    const payload = {
      items: items.map((it) => ({
        ...(it.id ? { id: it.id } : {}),
        imageUrl: it.imageUrl.trim(),
        productId: it.productId.trim(),
        active: it.active,
      })),
    };

    beginSave();
    try {
      const data = await adminBackendJson<{ items: HomepageSetApiItem[] }>(
        'settings/admin/homepage-sets',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      );
      setItems(
        (data.items ?? []).map((it) => ({
          key: it.id,
          id: it.id,
          imageUrl: it.imageUrl,
          productId: it.productId,
          productName: it.product?.name ?? '',
          active: it.active,
        })),
      );
      succeedSave();
      showToast('Наборы сохранены');
      const revalidated = await revalidateHomeStorefront();
      if (!revalidated) {
        showToast('Сохранено, но кэш витрины не обновился — обновите главную вручную');
      }
    } catch (err) {
      showToast(failSave(err));
    }
  }

  const pickerItem = pickerKey ? items.find((i) => i.key === pickerKey) : null;
  const canEdit = loadedOk && !loading && !uploading;
  const canSave = canEdit && dirty && !saving;

  return (
    <div>
      {!embedded ? <h1 className={catalogStyles.title}>Наборы на главной</h1> : null}
      <p className={catalogStyles.lead}>
        Lifestyle-картинка и товар для блока «Наборы». На витрине показывается первый активный
        набор. Не путать с каталожными наборами в «Каталог → Наборы».
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
          Не удалось загрузить наборы. Нажмите «Повторить» — сохранение отключено, чтобы не стереть
          данные.
        </p>
      ) : (
        <form onSubmit={(e) => void onSave(e)} className={`${catalogStyles.form} ${catalogStyles.formWide}`}>
          {dirty ? (
            <p className={catalogStyles.lead}>Несохранённые изменения</p>
          ) : null}
          {uploading ? <p className={catalogStyles.lead}>Загрузка изображения…</p> : null}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={items.map((i) => i.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul className={styles.faqList}>
                {items.map((item, index) => (
                  <SortableHomepageSetRow
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
                    onUpload={(file) => onUpload(item.key, file)}
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
            <p className={catalogStyles.lead}>Наборов пока нет</p>
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
                    productId: '',
                    productName: '',
                    active: true,
                  },
                ]);
              }}
            >
              Добавить набор
            </AdminCompactBtn>
            <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </AdminCompactBtn>
          </div>
        </form>
      )}

      <DiscountProductPickerModal
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
          if (
            id &&
            items.some((row) => row.key !== pickerKey && row.productId.trim() === id)
          ) {
            showToast('Этот товар уже выбран в другом наборе');
            return;
          }
          markDirty();
          setItems((prev) =>
            prev.map((row) =>
              row.key === pickerKey
                ? {
                    ...row,
                    productId: id ?? '',
                    productName: id ? (labels[id] ?? row.productName) : '',
                  }
                : row,
            ),
          );
          setPickerOpen(false);
          setPickerKey(null);
        }}
      />
    </div>
  );
}
