import { BlogPostEditorClient } from '../BlogPostEditorClient';

export default function AdminBlogEditPage({ params }: { params: { id: string } }) {
  return <BlogPostEditorClient postId={params.id} />;
}
