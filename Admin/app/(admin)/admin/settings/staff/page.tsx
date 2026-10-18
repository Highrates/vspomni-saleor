import { StaffAdminClient } from './StaffAdminClient';
import { getAdminSession } from '@/lib/getAdminSession';
import { redirect } from 'next/navigation';

export default async function AdminStaffPage() {
  const session = await getAdminSession();
  if (!session.authenticated) redirect('/admin/login');
  if (!session.staff?.isSuperAdmin) redirect('/admin');

  return <StaffAdminClient currentUserId={session.user.id} />;
}
