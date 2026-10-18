import { DiscountFormClient } from '../DiscountFormClient';

export default function AdminDiscountEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <DiscountFormClient discountId={params.id} />;
}
