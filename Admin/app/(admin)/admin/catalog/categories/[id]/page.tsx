import { CategoryFormClient } from '../CategoryFormClient';

export default function AdminCategoryEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <CategoryFormClient categoryId={params.id} />;
}
