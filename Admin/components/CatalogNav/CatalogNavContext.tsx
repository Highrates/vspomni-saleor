'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicCatalogTag, PublicCategoryNode } from '@/lib/publicCatalog';

export type CatalogNavValue = {
  categories: PublicCategoryNode[];
  tags: PublicCatalogTag[];
};

const CatalogNavContext = createContext<CatalogNavValue>({
  categories: [],
  tags: [],
});

export function CatalogNavProvider({
  value,
  children,
}: {
  value: CatalogNavValue;
  children: ReactNode;
}) {
  return (
    <CatalogNavContext.Provider value={value}>{children}</CatalogNavContext.Provider>
  );
}

export function useCatalogNav(): CatalogNavValue {
  return useContext(CatalogNavContext);
}
