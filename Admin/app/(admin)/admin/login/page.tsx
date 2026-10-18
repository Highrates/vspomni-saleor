import { Suspense } from 'react';
import { AdminLoginForm } from './AdminLoginForm';
import styles from './login.module.css';

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.wrap}>
          <main className={styles.card}>
            <p className={styles.hint}>Загрузка…</p>
          </main>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
