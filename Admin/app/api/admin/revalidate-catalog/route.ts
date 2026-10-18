import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/requireAdminSection';

export const runtime = 'nodejs';

/** On-demand ISR сброс витрины каталога (после правок в админке). */
export async function POST(request: NextRequest) {
  const gate = await requireAdminSection('catalog');
  if (!gate.ok) return gate.response;

  let productSlug: string | undefined;
  let cat: string | undefined;
  let sub: string | undefined;
  try {
    const body = (await request.json()) as {
      productSlug?: string;
      cat?: string;
      sub?: string;
    };
    productSlug =
      typeof body.productSlug === 'string' ? body.productSlug.trim() : undefined;
    cat = typeof body.cat === 'string' ? body.cat.trim() : undefined;
    sub = typeof body.sub === 'string' ? body.sub.trim() : undefined;
  } catch {
    /* empty body ok */
  }

  revalidateTag('catalog');
  revalidatePath('/catalog');
  revalidatePath('/', 'layout');
  if (cat) {
    revalidatePath(
      sub
        ? `/catalog/${encodeURIComponent(cat)}/${encodeURIComponent(sub)}`
        : `/catalog/${encodeURIComponent(cat)}`,
    );
  }
  if (productSlug) {
    revalidatePath(`/product/${encodeURIComponent(productSlug)}`);
  }

  return NextResponse.json({
    revalidated: true,
    productSlug: productSlug ?? null,
    cat: cat ?? null,
    sub: sub ?? null,
  });
}
