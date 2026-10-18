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
import { useCallback, useEffect, useState } from 'react';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminSettingsListErrors } from '@/components/admin/AdminSettingsListErrors/AdminSettingsListErrors';
import { AdminTextArea, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import { useToast } from '@/components/Toast/ToastProvider';
import { adminBackendJson } from '@/lib/adminBackendFetch';
import { useAdminSettingsListShell } from '@/lib/useAdminSettingsListShell';
import { revalidateFaqStorefront } from '@/lib/revalidateFaqStorefront';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from '@/app/(admin)/admin/settings/Settings.module.css';

type FaqDraft = {
  key: string;
  id?: string;
  question: string;
  answer: string;
  active: boolean;
};

type FaqApiItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  active: boolean;
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function SortableFaqRow({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: FaqDraft;
  disabled: boolean;
  onChange: (patch: Partial<FaqDraft>) => void;
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
      <AdminTextField
        label="Вопрос"
        value={item.question}
        onChange={(e) => onChange({ question: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />
      <AdminTextArea
        label="Ответ"
        value={item.answer}
        onChange={(e) => onChange({ answer: e.target.value })}
        disabled={disabled}
        rows={4}
        maxLength={10000}
      />
    </li>
  );
}

export function FaqAdminClient() {
  const { showToast } = useToast();
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
  } = useAdminSettingsListShell();
  const [items, setItems] = useState<FaqDraft[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    beginLoad();
    try {
      const data = await adminBackendJson<{ items: FaqApiItem[] }>('settings/admin/faq');
      setItems(
        (data.items ?? []).map((it) => ({
          key: it.id,
          id: it.id,
          question: it.question,
          answer: it.answer,
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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk) return;

    const incomplete = items.filter(
      (it) => !it.question.trim() || !it.answer.trim(),
    );
    if (incomplete.length > 0) {
      showToast(
        incomplete.length === 1
          ? 'Заполните вопрос и ответ или удалите пустой пункт'
          : `Есть пустые пункты (${incomplete.length}) — заполните или удалите`,
      );
      return;
    }

    const payload = {
      items: items.map((it) => ({
        ...(it.id ? { id: it.id } : {}),
        question: it.question.trim(),
        answer: it.answer.trim(),
        active: it.active,
      })),
    };

    beginSave();
    try {
      const data = await adminBackendJson<{ items: FaqApiItem[] }>('settings/admin/faq', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setItems(
        (data.items ?? []).map((it) => ({
          key: it.id,
          id: it.id,
          question: it.question,
          answer: it.answer,
          active: it.active,
        })),
      );
      succeedSave();
      showToast('FAQ сохранён');
      const revalidated = await revalidateFaqStorefront();
      if (!revalidated) {
        showToast('Сохранено, но кэш витрины не обновился — обновите /faq вручную');
      }
    } catch (err) {
      showToast(failSave(err));
    }
  }

  const canEdit = loadedOk && !loading;
  const canSave = canEdit && dirty && !saving;

  return (
    <div>
      <div className={styles.hubHeader}>
        <h1 className={`${catalogStyles.title} ${styles.hubHeaderTitle}`}>FAQ</h1>
        <a
          className={styles.storefrontLink}
          href="/faq"
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть FAQ ↗
        </a>
      </div>

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
          Не удалось загрузить FAQ. Нажмите «Повторить» — сохранение отключено, чтобы не стереть
          данные.
        </p>
      ) : (
        <form onSubmit={(e) => void onSave(e)} className={`${catalogStyles.form} ${catalogStyles.formWide}`}>
          {dirty ? (
            <p className={catalogStyles.lead}>Несохранённые изменения</p>
          ) : null}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={items.map((i) => i.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul className={styles.faqList}>
                {items.map((item, index) => (
                  <SortableFaqRow
                    key={item.key}
                    item={item}
                    disabled={saving}
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
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {items.length === 0 ? (
            <p className={catalogStyles.lead}>Вопросов пока нет</p>
          ) : null}

          <div className={catalogStyles.formActions}>
            <AdminCompactBtn
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                markDirty();
                setItems((prev) => [
                  ...prev,
                  { key: newKey(), question: '', answer: '', active: true },
                ]);
              }}
            >
              Добавить вопрос
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
