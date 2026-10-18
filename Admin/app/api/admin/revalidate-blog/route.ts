import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/requireAdminSection';

export const runtime = 'nodejs';

/** On-demand ISR сброс витрины блога (после publish/unpublish в админке). */
export async function POST(request: NextRequest) {
  const gate = await requireAdminSection('blog');
  if (!gate.ok) return gate.response;

  let slug: string | undefined;
  try {
    const body = (await request.json()) as { slug?: string };
    slug = typeof body.slug === 'string' ? body.slug.trim() : undefined;
  } catch {
    /* empty body ok */
  }

  revalidateTag('blog');
  revalidatePath('/blog');
  revalidatePath('/');
  if (slug) {
    revalidatePath(`/blog/${encodeURIComponent(slug)}`);
  }

  return NextResponse.json({ revalidated: true, slug: slug ?? null });
}
