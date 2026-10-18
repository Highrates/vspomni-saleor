'use client';

import React, { useCallback, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as transition from './transitionLogic';

type TransitionContextType = {
  navigateWithTransition: (href: string, fromMenu?: boolean) => void;
};

const Context = React.createContext<TransitionContextType | null>(null);

export function useSiteTransition() {
  return useContext(Context);
}

export function SiteTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    transition.preloadTransitionAnimate();
  }, []);

  const navigateWithTransition = useCallback(
    (href: string, fromMenu: boolean = false) => {
      transition.entering();
      transition.exit(fromMenu ? 'menu' : 'default').then(() => {
        router.push(href);
      });
    },
    [router],
  );

  return (
    <Context.Provider value={{ navigateWithTransition }}>{children}</Context.Provider>
  );
}
