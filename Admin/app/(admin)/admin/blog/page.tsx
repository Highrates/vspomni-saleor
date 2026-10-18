import { redirect } from 'next/navigation';

/** Блог перенесён во вкладку «Страницы». */
export default function AdminBlogRedirectPage() {
  redirect('/admin/pages');
}
