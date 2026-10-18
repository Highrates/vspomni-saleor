import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/requireAdminSection';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const gate = await requireAdminSection('blog');
  if (!gate.ok) return gate.response;

  let slug: string | undefined;
  try {
    const body = (await req.json()) as { slug?: string };
    if (typeof body?.slug === 'string' && body.slug.trim()) {
      slug = body.slug.trim();
    }
  } catch {
    /* empty body ok */
  }

  revalidateTag('cms');
  if (slug) {
    revalidatePath(`/${slug}`);
    revalidateTag(`cms:${slug}`);
  } else {
    revalidatePath('/privacy');
    revalidatePath('/terms');
    revalidatePath('/delivery');
    revalidatePath('/about');
  }

  return NextResponse.json({ revalidated: true });
}
