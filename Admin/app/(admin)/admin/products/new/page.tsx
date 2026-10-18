import { redirect } from 'next/navigation';

export default function AdminProductNewRedirect() {
  redirect('/admin/catalog/products/new');
}
