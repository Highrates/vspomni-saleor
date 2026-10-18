import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/requireAdminSection';

export const runtime = 'nodejs';

export async function POST() {
  const gate = await requireAdminSection('settings');
  if (!gate.ok) return gate.response;

  revalidateTag('faq');
  revalidatePath('/');
  revalidatePath('/faq');

  return NextResponse.json({ revalidated: true });
}
