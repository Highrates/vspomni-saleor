import { Suspense } from 'react';
import { PagesAdminClient } from './PagesAdminClient';

export default function AdminPagesPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <PagesAdminClient />
    </Suspense>
  );
}
