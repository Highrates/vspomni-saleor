import { CollectionFormClient } from '../CollectionFormClient';

export default function AdminCollectionEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <CollectionFormClient collectionId={params.id} />;
}
