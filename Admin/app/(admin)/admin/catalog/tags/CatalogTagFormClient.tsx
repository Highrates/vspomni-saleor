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
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTextArea, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import type { AdminCatalogTag } from '@/lib/adminCatalogTypes';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import {
  ProductGalleryEditor,
  type GalleryImage,
} from '@/app/(admin)/admin/catalog/products/ProductGalleryEditor';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import stepStyles from '@/app/(admin)/admin/settings/Settings.module.css';

type StepDraft = {
  key: string;
  id?: string;
  title: string;
  description: string;
};

function newStepKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function SortableStepRow({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: StepDraft;
  disabled: boolean;
  onChange: (patch: Partial<StepDraft>) => void;
  onRemove: () => void;
}) {
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
      className={`${stepStyles.faqCard} ${isDragging ? stepStyles.faqCardDragging : ''}`}
    >
      <div className={stepStyles.faqCardHead}>
        <button
          type="button"
          className={stepStyles.dragBtn}
          {...attributes}
          {...listeners}
          aria-label="Перетащить"
          disabled={disabled}
        >
          ⋮⋮
        </button>
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
      <AdminTextField
        label="Заголовок"
        value={item.title}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={disabled}
      />
      <AdminTextArea
        label="Описание"
        value={item.description}
        onChange={(e) => onChange({ description: e.target.value })}
        disabled={disabled}
        rows={4}
      />
    </li>
  );
}

export function CatalogTagFormClient({ tagId }: { tagId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(tagId);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!tagId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = await adminBackendJson<AdminCatalogTag>(
          `catalog/admin/catalog-tags/${tagId}`,
        );
        if (cancelled) return;
        setName(row.name);
        setSlug(row.slug);
        setImages(
          (row.images ?? []).map((img) => ({
            id: img.id,
            url: img.url,
            sortOrder: img.sortOrder,
          })),
        );
        setSteps(
          (row.steps ?? []).map((step) => ({
            key: step.id,
            id: step.id,
            title: step.title,
            description: step.description,
          })),
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof AdminBackendRequestError || e instanceof Error ? e.message : 'Ошибка',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tagId]);

  function onStepsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSteps((prev) => {
      const oldIndex = prev.findIndex((i) => i.key === active.id);
      const newIndex = prev.findIndex((i) => i.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('Укажите название');
      const body = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        steps: steps
          .filter((s) => s.title.trim())
          .map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            title: s.title.trim(),
            description: s.description.trim(),
          })),
      };
      if (isEdit && tagId) {
        const updated = await adminBackendJson<AdminCatalogTag>(
          `catalog/admin/catalog-tags/${tagId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        );
        setSlug(updated.slug);
        setSteps(
          (updated.steps ?? []).map((step) => ({
            key: step.id,
            id: step.id,
            title: step.title,
            description: step.description,
          })),
        );
        await revalidateCatalogStorefront();
        router.refresh();
      } else {
        const created = await adminBackendJson<AdminCatalogTag>('catalog/admin/catalog-tags', {
          method: 'POST',
          body: JSON.stringify({ name: body.name, slug: body.slug }),
        });
        await revalidateCatalogStorefront();
        router.push(`/admin/catalog/tags/${created.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof AdminBackendRequestError || err instanceof Error
          ? err.message
          : 'Не удалось сохранить',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Загрузка…</p>;

  return (
    <form onSubmit={(e) => void onSave(e)} className={styles.form}>
      <p className={styles.backRow}>
        <AdminCompactBtnLink href="/admin/catalog/tags" variant="outline">
          ← К списку
        </AdminCompactBtnLink>
      </p>
      <div className={styles.detailTitleRow}>
        <h1 className={styles.title}>{isEdit ? 'Аромат' : 'Новый аромат'}</h1>
        <div className={styles.detailTitleActions}>
          <AdminCompactBtn type="submit" variant="accent" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </AdminCompactBtn>
        </div>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <AdminTextField label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
      <AdminTextField
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={isEdit ? undefined : 'пусто → авто из названия'}
      />

      {isEdit && tagId ? (
        <>
          <ProductGalleryEditor
            title="Обложка / галерея"
            acceptVideo={false}
            images={images}
            onChange={setImages}
            api={{
              uploadPath: `catalog/admin/catalog-tags/${tagId}/images`,
              reorderPath: `catalog/admin/catalog-tags/${tagId}/images/reorder`,
              deletePath: (id) => `catalog/admin/catalog-tag-images/${id}`,
            }}
          />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Информационные блоки</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepsDragEnd}>
              <SortableContext
                items={steps.map((i) => i.key)}
                strategy={verticalListSortingStrategy}
              >
                <ul className={stepStyles.faqList}>
                  {steps.map((item, index) => (
                    <SortableStepRow
                      key={item.key}
                      item={item}
                      disabled={saving}
                      onChange={(patch) => {
                        setSteps((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                        );
                      }}
                      onRemove={() => {
                        setSteps((prev) => prev.filter((_, i) => i !== index));
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {steps.length === 0 ? (
              <p className={styles.muted}>Блоков пока нет</p>
            ) : null}
            <div className={styles.formActions}>
              <AdminCompactBtn
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setSteps((prev) => [
                    ...prev,
                    { key: newStepKey(), title: '', description: '' },
                  ]);
                }}
              >
                Добавить инфо
              </AdminCompactBtn>
            </div>
          </section>
        </>
      ) : (
        <p className={styles.cardNote}>
          Галерею и информационные блоки можно добавить после первого сохранения тега.
        </p>
      )}
    </form>
  );
}
