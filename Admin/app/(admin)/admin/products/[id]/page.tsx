import { redirect } from 'next/navigation';

export default function AdminProductEditRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/admin/catalog/products/${params.id}`);
}
