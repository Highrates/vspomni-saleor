import { VariantFormClient } from '../../../VariantFormClient';

export default function AdminVariantNewPage({
  params,
}: {
  params: { id: string };
}) {
  return <VariantFormClient productId={params.id} />;
}
