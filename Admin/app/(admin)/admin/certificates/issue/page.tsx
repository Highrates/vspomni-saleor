import { redirect } from 'next/navigation';

export default function AdminCertificateIssuePage() {
  redirect('/admin/certificates?tab=issue');
}
