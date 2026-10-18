import { redirect } from 'next/navigation';

export default function AdminDenominationsPage() {
  redirect('/admin/certificates?tab=denoms');
}
