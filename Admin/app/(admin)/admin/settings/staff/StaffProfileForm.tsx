'use client';

import { AdminTextField } from '@/components/AdminTextField/AdminTextField';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import { StaffAvatarField } from './StaffAvatarField';
import { formatStaffLastLogin } from './staffUtils';
import styles from './staffAdmin.module.css';

export type StaffProfileFormProps = {
  email: string;
  onEmailChange?: (value: string) => void;
  emailDisabled?: boolean;
  emailType?: 'email' | 'text';
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  showAvatar?: boolean;
  avatarUrl?: string | null;
  avatarAlt?: string;
  onAvatarSelect?: (file: File) => void;
  avatarUploading?: boolean;
  avatarDisabled?: boolean;
  role?: 'ADMIN' | 'MODERATOR';
  isActive?: boolean;
  lastAdminLoginAt?: string | null;
  showMeta?: boolean;
  children?: React.ReactNode;
};

export function StaffProfileForm({
  email,
  onEmailChange,
  emailDisabled = true,
  emailType = 'text',
  displayName,
  onDisplayNameChange,
  showAvatar = false,
  avatarUrl = null,
  avatarAlt,
  onAvatarSelect,
  avatarUploading = false,
  avatarDisabled = false,
  role,
  isActive,
  lastAdminLoginAt,
  showMeta = false,
  children,
}: StaffProfileFormProps) {
  return (
    <div className={styles.profileFormFields}>
      {showAvatar && onAvatarSelect ? (
        <StaffAvatarField
          label="Аватар"
          previewUrl={avatarUrl}
          previewAlt={avatarAlt}
          uploading={avatarUploading}
          disabled={avatarDisabled}
          onFileSelect={onAvatarSelect}
        />
      ) : null}
      <AdminTextField
        label="Email"
        value={email}
        onChange={onEmailChange ? (e) => onEmailChange(e.target.value) : undefined}
        disabled={emailDisabled || !onEmailChange}
        type={emailType}
        autoComplete="off"
      />
      <AdminTextField
        label="Отображаемое имя"
        value={displayName}
        onChange={(e) => onDisplayNameChange(e.target.value)}
        maxLength={120}
        autoComplete="off"
      />
      {showMeta && role != null && isActive != null ? (
        <p className={catalogStyles.lead}>
          Роль: {role === 'ADMIN' ? 'Суперадмин' : 'Модератор'}
          {' · '}
          Статус: {isActive ? 'активен' : 'неактивен'}
          {' · '}
          Вход: {formatStaffLastLogin(lastAdminLoginAt ?? null)}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function StaffFlashMessage({ message }: { message: string }) {
  return (
    <p className={`${catalogStyles.lead} ${styles.flashSuccess}`} role="status">
      {message}
    </p>
  );
}
