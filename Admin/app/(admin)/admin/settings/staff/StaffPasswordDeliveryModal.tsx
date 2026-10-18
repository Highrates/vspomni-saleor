'use client';

import { useState } from 'react';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminModal } from '@/components/admin/AdminModal/AdminModal';

/** Статус доставки пароля (не reveal по умолчанию — только если API отдал temporaryPassword). */
export function StaffPasswordDeliveryModal({
  open,
  emailSent,
  temporaryPassword,
  onClose,
  onRetry,
  retrying = false,
}: {
  open: boolean;
  emailSent?: boolean;
  temporaryPassword?: string | null;
  onClose: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canReveal = Boolean(temporaryPassword?.trim());

  async function copyPassword() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <AdminModal
      open={open}
      title="Пароль сотрудника"
      onClose={onClose}
      footer={
        <>
          {canReveal ? (
            <AdminCompactBtn type="button" variant="accent" onClick={() => void copyPassword()}>
              {copied ? 'Скопировано' : 'Копировать пароль'}
            </AdminCompactBtn>
          ) : null}
          {!emailSent && onRetry ? (
            <AdminCompactBtn type="button" disabled={retrying} onClick={onRetry}>
              {retrying ? 'Отправка…' : 'Отправить снова'}
            </AdminCompactBtn>
          ) : null}
          <AdminCompactBtn type="button" onClick={onClose}>
            Закрыть
          </AdminCompactBtn>
        </>
      }
    >
      <p>
        Пароль сгенерирован однократно. В постоянном хранилище и prod-логах он не
        сохраняется.
      </p>
      {emailSent ? (
        <p>Письмо с паролем отправлено на email сотрудника.</p>
      ) : (
        <>
          <p style={{ color: 'var(--color-danger, #c0392b)' }}>
            Письмо не отправлено (SMTP ещё не настроен или ошибка доставки).
          </p>
          {canReveal ? (
            <>
              <p>Покажите пароль сотруднику сейчас — потом его нельзя будет посмотреть в системе:</p>
              <p
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '1.05rem',
                  letterSpacing: '0.04em',
                  wordBreak: 'break-all',
                  margin: '12px 0',
                }}
              >
                {temporaryPassword}
              </p>
            </>
          ) : (
            <p>Повторите отправку — будет сгенерирован новый пароль.</p>
          )}
        </>
      )}
    </AdminModal>
  );
}
