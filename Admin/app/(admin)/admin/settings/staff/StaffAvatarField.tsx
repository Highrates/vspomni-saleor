'use client';

import { useRef } from 'react';
import styles from './staffAdmin.module.css';

/** В prod Admin за nginx с assetPrefix `/_va` — public тоже отдаётся с этим префиксом. */
const DEFAULT_STAFF_AVATAR =
  process.env.NODE_ENV === 'production'
    ? '/_va/images/Admin-avatar.jpeg'
    : '/images/Admin-avatar.jpeg';
const DEFAULT_AVATAR_HINT = 'JPEG, PNG или WebP, до 6 МБ';

export function StaffAvatarField({
  label,
  previewUrl,
  previewAlt,
  disabled,
  uploading,
  hint = DEFAULT_AVATAR_HINT,
  onFileSelect,
}: {
  label: string;
  previewUrl: string | null;
  /** Доступный alt для превью; по умолчанию — «Аватар сотрудника». */
  previewAlt?: string;
  disabled?: boolean;
  uploading?: boolean;
  hint?: string | null;
  onFileSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const src = previewUrl?.trim() || DEFAULT_STAFF_AVATAR;
  const alt = previewAlt?.trim() || 'Аватар сотрудника';

  return (
    <div className={styles.avatarField}>
      <span className={styles.avatarLabel}>{label}</span>
      <label
        className={`${styles.avatarPicker} ${disabled || uploading ? styles.avatarPickerDisabled : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={styles.avatarImage} width={96} height={96} />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.avatarInput}
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onFileSelect(file);
          }}
        />
      </label>
      {hint ? <p className={styles.avatarHint}>{hint}</p> : null}
    </div>
  );
}

export { DEFAULT_STAFF_AVATAR };
