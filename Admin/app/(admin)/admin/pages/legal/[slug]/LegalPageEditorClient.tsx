'use client';

import { useParams } from 'next/navigation';
import { CmsPageEditorClient } from '../../CmsPageEditorClient';

export function LegalPageEditorClient() {
  const { slug } = useParams<{ slug: string }>();
  return <CmsPageEditorClient slug={String(slug ?? '')} />;
}
