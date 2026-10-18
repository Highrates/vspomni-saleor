'use client';

import { useFavorites } from '@/lib/favorites/FavoritesContext';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './FavoriteButton.module.css';

export function FavoriteButton({
  variantId,
  className,
}: {
  variantId?: string | null;
  className?: string;
}) {
  const { ready, isFavorite, toggle } = useFavorites();
  const { showToast } = useToast();
  const active = isFavorite(variantId);

  if (!variantId) return null;

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!ready) return;
    const result = await toggle(variantId!);
    if (result === 'auth') {
      showToast('Войдите, чтобы добавить в избранное');
      return;
    }
    if (result === 'error') {
      showToast('Не удалось обновить избранное');
      return;
    }
    showToast(result === 'added' ? 'В избранном' : 'Убрано из избранного');
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${active ? styles.active : ''} ${className ?? ''}`.trim()}
      onClick={(e) => void onClick(e)}
      aria-pressed={active}
      aria-label={active ? 'Убрать из избранного' : 'В избранное'}
      title={active ? 'Убрать из избранного' : 'В избранное'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 20s-7-4.4-7-9.2A4.2 4.2 0 0 1 12 7.1a4.2 4.2 0 0 1 7 3.7C19 15.6 12 20 12 20Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'}
        />
      </svg>
    </button>
  );
}
