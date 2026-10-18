'use client';

import React from 'react';
import Link from 'next/link';
import { useSiteTransition } from './SiteTransitionContext';

type TransitionLinkProps = React.ComponentProps<typeof Link> & {
  fromMenu?: boolean;
};

export function TransitionLink({
  href,
  fromMenu = false,
  onClick,
  children,
  ...rest
}: TransitionLinkProps) {
  const ctx = useSiteTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (ctx && typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      ctx.navigateWithTransition(href, fromMenu);
    }
    onClick?.(e);
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
