'use client';

import { useEffect, useRef, useState } from 'react';
import { DiscountProductPickerModal } from '@/app/(admin)/admin/discounts/DiscountScopePickerModal';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import {
  AdminSortableTable,
  DragHandleCell,
} from '@/components/admin/AdminSortableTable/AdminSortableTable';
import { adminBackendJson } from '@/lib/adminBackendFetch';
import type { AdminProduct } from '@/lib/adminCatalogTypes';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

/** Выбранные товары + модалка добавления; порядок — drag. */
export function ProductIdsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  useEffect(() => {
    let cancelled = false;
    const missing = value.filter((id) => !labelsRef.current[id]);
    if (missing.length === 0) return;

    setResolving(true);
    void (async () => {
      const fetched: Record<string, string> = {};
      await Promise.all(
        missing.map(async (id) => {
          try {
            const p = await adminBackendJson<AdminProduct>(`catalog/admin/products/${id}`);
            fetched[id] = p.name;
          } catch {
            fetched[id] = id;
          }
        }),
      );
      if (cancelled) return;
      setLabels((prev) => ({ ...prev, ...fetched }));
      setResolving(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  function onApply(ids: string[], nextLabels: Record<string, string>) {
    const idSet = new Set(ids);
    const kept = value.filter((id) => idSet.has(id));
    const added = ids.filter((id) => !value.includes(id));
    onChange([...kept, ...added]);
    setLabels((prev) => ({ ...prev, ...nextLabels }));
  }

  return (
    <div className={styles.productIdsPicker}>
      <div className={styles.productIdsPickerToolbar}>
        <AdminCompactBtn type="button" variant="outline" onClick={() => setModalOpen(true)}>
          Добавить товар
        </AdminCompactBtn>
        {value.length > 0 ? (
          <span className={styles.muted}>Выбрано: {value.length}</span>
        ) : null}
      </div>

      {value.length === 0 ? (
        <p className={styles.muted}>Товары ещё не добавлены</p>
      ) : (
        <>
          {resolving ? <p className={styles.muted}>Подгружаем названия…</p> : null}
          <AdminSortableTable
            ids={value}
            onReorder={onChange}
            head={
              <tr>
                <th style={{ width: 36 }} aria-label="Порядок" />
                <th>Товар</th>
                <th style={{ width: 100 }} />
              </tr>
            }
            renderRow={(id, drag) => (
              <>
                <DragHandleCell {...drag} />
                <td>{labels[id] ?? id}</td>
                <td>
                  <AdminCompactBtn type="button" variant="outline" onClick={() => remove(id)}>
                    Убрать
                  </AdminCompactBtn>
                </td>
              </>
            )}
          />
        </>
      )}

      <DiscountProductPickerModal
        open={modalOpen}
        selectedIds={value}
        selectedLabels={labels}
        onClose={() => setModalOpen(false)}
        onApply={onApply}
      />
    </div>
  );
}
