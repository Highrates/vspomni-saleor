'use client';

import type { ReactNode } from 'react';
import {
  CatalogNavProvider,
  type CatalogNavValue,
} from '@/components/CatalogNav/CatalogNavContext';
import { CartProvider } from '@/lib/cart/CartContext';
import { FavoritesProvider } from '@/lib/favorites/FavoritesContext';
import { BuyerAuthProvider } from '@/lib/BuyerAuthProvider';
import { CartDrawer } from '@/components/CartDrawer/CartDrawer';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { SiteTransition, SiteTransitionProvider } from '@/components/SiteTransition';

export function SiteProviders({
  children,
  catalogNav,
  showCartDrawer = true,
}: {
  children: ReactNode;
  catalogNav: CatalogNavValue;
  showCartDrawer?: boolean;
}) {
  return (
    <CatalogNavProvider value={catalogNav}>
      <SiteTransitionProvider>
        <ToastProvider>
          <BuyerAuthProvider>
            <CartProvider>
              <FavoritesProvider>
                {children}
                {showCartDrawer ? <CartDrawer /> : null}
                <SiteTransition />
              </FavoritesProvider>
            </CartProvider>
          </BuyerAuthProvider>
        </ToastProvider>
      </SiteTransitionProvider>
    </CatalogNavProvider>
  );
}
