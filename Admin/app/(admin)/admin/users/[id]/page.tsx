import { UserDetailClient } from '../UserDetailClient';

export default function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <UserDetailClient userId={params.id} />;
}
