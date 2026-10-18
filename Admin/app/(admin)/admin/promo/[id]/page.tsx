import { PromoFormClient } from '../PromoFormClient';

export default function AdminPromoEditPage({ params }: { params: { id: string } }) {
  return <PromoFormClient promoId={params.id} />;
}
