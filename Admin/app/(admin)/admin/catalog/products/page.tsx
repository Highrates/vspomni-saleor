import { Suspense } from 'react';
import { ProductsListClient } from './ProductsListClient';

export default function AdminCatalogProductsPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <ProductsListClient />
    </Suspense>
  );
}
