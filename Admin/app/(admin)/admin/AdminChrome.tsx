'use client';

import { usePathname } from 'next/navigation';
import type { StaffContext } from '@/lib/adminStaffTypes';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { AdminConfirmHost } from '@/components/admin/AdminModal/adminConfirm';
import { AdminSidebarNav } from './AdminSidebarNav';
import styles from './layout.module.css';

export function AdminChrome({
  children,
  email,
  staff,
}: {
  children: React.ReactNode;
  email?: string | null;
  staff?: StaffContext | null;
}) {
  const pathname = usePathname() ?? '';
  const isLogin = pathname === '/admin/login';

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <ToastProvider>
      <div className={styles.shell}>
        <div className={styles.body}>
          <AdminSidebarNav staff={staff} email={email} />
          <div className={styles.content}>{children}</div>
        </div>
        <AdminConfirmHost />
      </div>
    </ToastProvider>
  );
}
