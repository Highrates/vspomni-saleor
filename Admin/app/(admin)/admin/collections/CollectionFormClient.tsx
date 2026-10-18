'use client';

import { CatalogProductGroupFormClient } from '../catalog/CatalogProductGroupFormClient';

export function CollectionFormClient({ collectionId }: { collectionId?: string }) {
  return <CatalogProductGroupFormClient kind="collections" id={collectionId} />;
}
