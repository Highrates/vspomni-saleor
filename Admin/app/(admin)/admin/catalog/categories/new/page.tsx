import { Suspense } from 'react';
import { CategoryFormClient } from '../CategoryFormClient';

export default function AdminCategoryNewPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <CategoryFormClient />
    </Suspense>
  );
}
