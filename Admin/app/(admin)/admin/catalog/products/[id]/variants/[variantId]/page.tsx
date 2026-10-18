import { VariantFormClient } from '../../../VariantFormClient';

export default function AdminVariantEditPage({
  params,
}: {
  params: { id: string; variantId: string };
}) {
  return <VariantFormClient productId={params.id} variantId={params.variantId} />;
}
