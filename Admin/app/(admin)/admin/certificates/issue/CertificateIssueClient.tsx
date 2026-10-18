'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminSelect, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { formatAdminMoney } from '@/lib/adminFormat';
import type {
  AdminGiftDenomination,
  IssueGiftCertificatesResponse,
} from '@/lib/adminGiftCertificateTypes';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

type Props = {
  onGoToDenoms?: () => void;
};

export function CertificateIssueClient({ onGoToDenoms }: Props) {
  const router = useRouter();
  const [denoms, setDenoms] = useState<AdminGiftDenomination[]>([]);
  const [denominationId, setDenominationId] = useState('');
  const [customFace, setCustomFace] = useState('');
  const [count, setCount] = useState('1');
  const [code, setCode] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssueGiftCertificatesResponse | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const countNum = useMemo(() => {
    const n = Math.floor(Number(count));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [count]);
  const codeDisabled = countNum > 1;

  const loadDenoms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await adminBackendJson<AdminGiftDenomination[]>(
        'gift-certificates/admin/denominations?active=1',
      );
      setDenoms(rows);
      if (rows[0]) setDenominationId(rows[0].id);
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки номиналов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDenoms();
  }, [loadDenoms]);

  useEffect(() => {
    if (codeDisabled && code) setCode('');
  }, [codeDisabled, code]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setIssued(null);
    setEmailWarning(null);
    try {
      const body: Record<string, unknown> = { count: countNum };
      if (denominationId) {
        body.denominationId = denominationId;
      } else {
        const fv = Math.floor(Number(customFace));
        if (!Number.isFinite(fv) || fv < 1) throw new Error('Укажите номинал');
        body.faceValue = fv;
      }
      if (code.trim() && countNum === 1) body.code = code.trim();
      if (recipientEmail.trim()) body.recipientEmail = recipientEmail.trim();
      if (expiresAt.trim()) body.expiresAt = new Date(`${expiresAt}T23:59:59.000+03:00`).toISOString();
      if (note.trim()) body.note = note.trim();

      const res = await adminBackendJson<IssueGiftCertificatesResponse>(
        'gift-certificates/admin/issue',
        { method: 'POST', body: JSON.stringify(body) },
      );
      setIssued(res);
      if (recipientEmail.trim() && res.emailDelivered === false) {
        setEmailWarning(
          'Сертификат(ы) выпущены, но письмо не отправлено (SMTP не настроен или ошибка). Код можно скопировать и отправить вручную.',
        );
      }
      if (res.count === 1 && res.items[0] && res.emailDelivered !== false) {
        router.push(`/admin/certificates/${res.items[0].id}`);
        return;
      }
    } catch (err) {
      setError(
        err instanceof AdminBackendRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка выпуска',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={styles.lead}>Загрузка…</p>;
  }

  return (
    <>
      <p className={styles.lead}>
        Ручной выпуск в админке. Те же номиналы — при покупке на сайте (/certificates).
        Без email получателя письмо не отправится — код можно скопировать после выпуска.
      </p>
      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}
      {emailWarning ? (
        <div className={styles.warningBanner} role="status">
          {emailWarning}
          {issued?.items[0] ? (
            <AdminCompactBtnLink href={`/admin/certificates/${issued.items[0].id}`}>
              Открыть сертификат
            </AdminCompactBtnLink>
          ) : null}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
        {denoms.length > 0 ? (
          <AdminSelect
            label="Номинал"
            value={denominationId}
            onChange={(e) => {
              setDenominationId(e.target.value);
              if (e.target.value) setCustomFace('');
            }}
          >
            {denoms.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {formatAdminMoney(d.faceValue)}
                {d.validityDays ? ` · ${d.validityDays} дн.` : ''}
              </option>
            ))}
            <option value="">Свой номинал…</option>
          </AdminSelect>
        ) : (
          <p className={styles.lead}>
            Нет активных номиналов — укажите сумму вручную или{' '}
            {onGoToDenoms ? (
              <AdminCompactBtn type="button" onClick={onGoToDenoms}>
                создайте номинал
              </AdminCompactBtn>
            ) : (
              <AdminCompactBtnLink href="/admin/certificates?tab=denoms">
                создайте номинал
              </AdminCompactBtnLink>
            )}
            .
          </p>
        )}

        {!denominationId ? (
          <AdminTextField
            label="Сумма, ₽"
            type="number"
            min={1}
            value={customFace}
            onChange={(e) => setCustomFace(e.target.value)}
            required
          />
        ) : null}

        <AdminTextField
          label="Количество"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <AdminTextField
          label="Свой код (только при выпуске 1 шт.)"
          value={code}
          onChange={(e) => {
            const v = e.target.value;
            setCode(v);
            if (v.trim() && countNum > 1) setCount('1');
          }}
          autoComplete="off"
          placeholder="JC-XXXX-XXXX-XXXX"
          disabled={codeDisabled}
        />
        {codeDisabled ? (
          <p className={styles.lead} style={{ marginTop: -8 }}>
            Свой код доступен только при количестве 1.
          </p>
        ) : null}
        <AdminTextField
          label="Email получателя (нужен для письма)"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          autoComplete="off"
        />
        <AdminTextField
          label="Срок до (дата, опционально)"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <AdminTextField
          label="Комментарий"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className={styles.formActions}>
          <AdminCompactBtn type="submit" variant="accent" disabled={saving}>
            {saving ? 'Выпуск…' : 'Выпустить'}
          </AdminCompactBtn>
        </div>
      </form>

      {issued && issued.count > 1 ? (
        <div className={styles.form} style={{ marginTop: 24 }}>
          <h2 className={styles.groupHeading}>Выпущено: {issued.count}</h2>
          <ul>
            {issued.items.map((item) => (
              <li key={item.id}>
                <AdminCompactBtnLink href={`/admin/certificates/${item.id}`}>
                  <code>{item.code}</code>
                </AdminCompactBtnLink>{' '}
                — {formatAdminMoney(item.faceValue)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
