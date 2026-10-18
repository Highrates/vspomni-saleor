'use client';

import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

export function AdminListPagination({
  page,
  total,
  limit,
  onPageChange,
  disabled,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className={styles.toolbar} style={{ marginTop: 16 }}>
      <AdminCompactBtn
        type="button"
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Назад
      </AdminCompactBtn>
      <span className={styles.cardNote}>
        Стр. {page} / {totalPages} · {total}
      </span>
      <AdminCompactBtn
        type="button"
        variant="outline"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Вперёд
      </AdminCompactBtn>
    </div>
  );
}
