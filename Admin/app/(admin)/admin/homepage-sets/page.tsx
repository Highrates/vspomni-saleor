import { HomepageSetsAdminClient } from '@/app/(admin)/admin/settings/home/sets/HomepageSetsAdminClient';

/** ACL: layout → section `settings` (как FAQ / quiz / menu). */
export default function AdminHomepageSetsPage() {
  return <HomepageSetsAdminClient />;
}
