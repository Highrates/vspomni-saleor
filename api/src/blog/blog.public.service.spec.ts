import { beforeEach, describe, expect, it, vi } from 'vitest';

const categoryFindFirst = vi.fn();
const postFindMany = vi.fn();
const postCount = vi.fn();
const postFindFirst = vi.fn();

vi.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    blogCategory = { findFirst: categoryFindFirst };
    blogPost = {
      findMany: postFindMany,
      count: postCount,
      findFirst: postFindFirst,
    };
  },
}));

import { BlogPublicService } from './blog.public.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BlogPublicService.listPosts', () => {
  let service: BlogPublicService;

  beforeEach(() => {
    categoryFindFirst.mockReset();
    postFindMany.mockReset();
    postCount.mockReset();
    service = new BlogPublicService(new PrismaService() as never);
  });

  it('неизвестный categorySlug → categoryMissing, без отдачи всех постов', async () => {
    categoryFindFirst.mockResolvedValueOnce(null);
    const res = await service.listPosts({ categorySlug: 'no-such' });
    expect(res.categoryMissing).toBe(true);
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
    expect(postFindMany).not.toHaveBeenCalled();
  });

  it('известный slug фильтрует по categoryId', async () => {
    categoryFindFirst.mockResolvedValueOnce({ id: 'cat1' });
    postFindMany.mockResolvedValueOnce([]);
    postCount.mockResolvedValueOnce(0);
    await service.listPosts({ categorySlug: 'events' });
    expect(postFindMany).toHaveBeenCalled();
    const arg = postFindMany.mock.calls[0]![0];
    expect(arg.where.categoryId).toBe('cat1');
    expect(arg.where.isPublished).toBe(true);
  });
});

describe('BlogPublicService.getPostBySlug', () => {
  let service: BlogPublicService;

  beforeEach(() => {
    postFindFirst.mockReset();
    service = new BlogPublicService(new PrismaService() as never);
  });

  it('требует isPublished и publishedAt <= now', async () => {
    postFindFirst.mockResolvedValueOnce(null);
    await service.getPostBySlug('x');
    const where = postFindFirst.mock.calls[0]![0].where;
    expect(where.isPublished).toBe(true);
    expect(where.OR).toBeTruthy();
  });

  it('отдаёт author.displayName', async () => {
    postFindFirst.mockResolvedValueOnce({
      id: '1',
      slug: 'x',
      title: 'T',
      excerpt: null,
      body: '<p>a</p>',
      coverUrl: null,
      publishedAt: new Date(),
      category: null,
      author: { id: 'u1', displayName: 'Анна' },
    });
    const res = await service.getPostBySlug('x');
    expect(res?.author).toEqual({ id: 'u1', displayName: 'Анна' });
  });
});
