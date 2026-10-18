'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FloatingTextField } from '@/components/FloatingTextField/FloatingTextField';
import { PrimaryBtn } from '@/components/PrimaryBtn/PrimaryBtn';
import { LogoPaths } from '@/components/SiteLoader/LogoPaths';
import { safeAdminReturnPath } from '@/lib/safeReturnPath';
import styles from './login.module.css';

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  const redirectTo = safeAdminReturnPath(fromParam);
  const redirectedRef = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (redirectedRef.current) return;
      try {
        const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
        const data = await res.json();
        if (cancelled || !data.authenticated || redirectedRef.current) return;
        redirectedRef.current = true;
        window.location.replace(redirectTo);
      } catch {
        /* stay on login */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redirectTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          emailOrPhone: email.trim(),
          password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === 'string' ? body.error : 'Не удалось войти');
        return;
      }
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        window.location.assign(redirectTo);
      }
    } catch {
      setError('Сеть недоступна');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <main className={styles.card}>
        <div className={styles.logo} aria-hidden>
          <LogoPaths />
        </div>
        <p className={styles.brand}>Vspomni · Админ</p>
        <h1 className={styles.title}>Вход</h1>
        <p className={styles.hint}>Email и пароль администратора</p>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <FloatingTextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FloatingTextField
            label="Пароль"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <PrimaryBtn type="submit" disabled={loading} className={styles.submit}>
            {loading ? 'Входим…' : 'Войти'}
          </PrimaryBtn>
        </form>
      </main>
    </div>
  );
}
