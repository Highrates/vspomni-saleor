'use client';

import { CatalogProductGroupFormClient } from '../catalog/CatalogProductGroupFormClient';

export function ProductSetFormClient({ productSetId }: { productSetId?: string }) {
  return <CatalogProductGroupFormClient kind="product-sets" id={productSetId} />;
}
