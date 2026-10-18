import { ProductSetFormClient } from '../ProductSetFormClient';

export default function AdminProductSetEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <ProductSetFormClient productSetId={params.id} />;
}
