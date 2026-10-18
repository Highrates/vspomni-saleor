import { CatalogTagFormClient } from '../CatalogTagFormClient';

export default function AdminCatalogTagEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <CatalogTagFormClient tagId={params.id} />;
}
