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
import { useEffect, useMemo, useState } from 'react';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminModal, AdminModalActions } from '@/components/admin/AdminModal/AdminModal';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import vg from './VariantGalleryModal.module.css';

export type VariantGallerySourceImage = {
  id: string;
  url: string;
  sortOrder: number;
  mediaType?: 'image' | 'video';
};

function SortableRow({
  id,
  url,
  mediaType,
  index,
  onRemove,
}: {
  id: string;
  url: string;
  mediaType?: string;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };
  const isVideo = mediaType === 'video' || /\.(mp4|mov)(\?|$)/i.test(url);

  return (
    <li ref={setNodeRef} style={style} className={vg.row}>
      <button type="button" className={vg.drag} {...attributes} {...listeners} title="Перетащить">
        ⋮⋮
      </button>
      <span className={vg.ord}>{index + 1}</span>
      {isVideo ? (
        <span className={vg.thumbVideo}>Видео</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={vg.thumb} src={url} alt="" />
      )}
      <button type="button" className={vg.remove} onClick={onRemove} aria-label="Убрать">
        ×
      </button>
    </li>
  );
}

export function VariantGalleryModal({
  open,
  onClose,
  onApply,
  productImages,
  selectedIds,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (orderedIds: string[]) => void;
  productImages: VariantGallerySourceImage[];
  selectedIds: string[];
}) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (open) setDraft(selectedIds);
  }, [open, selectedIds]);

  const byId = useMemo(() => {
    const m = new Map(productImages.map((img) => [img.id, img]));
    return m;
  }, [productImages]);

  const available = useMemo(
    () => productImages.filter((img) => !draft.includes(img.id)),
    [productImages, draft],
  );

  function toggleAvailable(id: string, checked: boolean) {
    setDraft((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return (
    <AdminModal
      open={open}
      title="Галерея варианта"
      onClose={onClose}
      wide
      footer={
        <AdminModalActions
          onCancel={onClose}
          onConfirm={() => {
            onApply(draft);
            onClose();
          }}
          confirmLabel="Готово"
        />
      }
    >
      <div className={vg.layout}>
        <div>
          <p className={styles.cardNote}>Порядок в галерее варианта</p>
          {draft.length === 0 ? (
            <p className={styles.muted}>Ничего не выбрано — отметьте кадры справа</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={draft} strategy={verticalListSortingStrategy}>
                <ul className={vg.list}>
                  {draft.map((id, index) => {
                    const img = byId.get(id);
                    if (!img) return null;
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        url={img.url}
                        mediaType={img.mediaType}
                        index={index}
                        onRemove={() => setDraft((prev) => prev.filter((x) => x !== id))}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
        <div>
          <p className={styles.cardNote}>Галерея товара</p>
          {productImages.length === 0 ? (
            <p className={styles.muted}>У товара ещё нет медиа</p>
          ) : (
            <ul className={vg.pickList}>
              {productImages.map((img) => {
                const checked = draft.includes(img.id);
                const isVideo =
                  img.mediaType === 'video' || /\.(mp4|mov)(\?|$)/i.test(img.url);
                return (
                  <li key={img.id} className={vg.pickRow}>
                    <AdminCheckbox
                      checked={checked}
                      onChange={(e) => toggleAvailable(img.id, e.target.checked)}
                      aria-label={isVideo ? 'Видео' : 'Фото'}
                    />
                    {isVideo ? (
                      <span className={vg.thumbVideo}>Видео</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={vg.thumb} src={img.url} alt="" />
                    )}
                    {!checked && available.some((a) => a.id === img.id) ? null : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
