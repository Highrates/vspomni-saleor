import { redirect } from 'next/navigation';

/** Legacy hub → отдельные страницы в «Контент». */
export default function AdminHomeContentHubRedirect({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  if (searchParams?.tab === 'sets') {
    redirect('/admin/homepage-sets');
  }
  redirect('/admin/hero');
}
