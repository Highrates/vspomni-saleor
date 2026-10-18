import { ProductFormClient } from '../ProductFormClient';

export default function AdminCatalogProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <ProductFormClient productId={params.id} />;
}
