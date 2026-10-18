import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

const blogPost = {
  findMany: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
  count: vi.fn(),
};
const blogCategory = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
};
const tx = vi.fn(async (ops: unknown) => {
  if (Array.isArray(ops)) await Promise.all(ops);
});

vi.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    blogPost = blogPost;
    blogCategory = blogCategory;
    $transaction = tx;
  },
}));

vi.mock('../storage/local-storage.service', () => ({
  LocalStorageService: class {
    tryPublicUrlToKey = vi.fn(() => 'blog/x.jpg');
    saveImage = vi.fn(async () => ({ url: 'http://x/uploads/blog/a.jpg', key: 'blog/a.jpg' }));
    deleteByPublicUrl = vi.fn();
  },
}));

import { BlogAdminService } from './blog.admin.service';

describe('BlogAdminService.reorderPosts', () => {
  let service: BlogAdminService;

  beforeEach(() => {
    blogPost.findMany.mockReset();
    blogPost.update.mockReset();
    tx.mockClear();
    service = new BlogAdminService(
      { blogPost, blogCategory, $transaction: tx } as never,
      {
        tryPublicUrlToKey: () => 'blog/x.jpg',
        saveImage: async () => ({ url: 'http://x/uploads/blog/a.jpg', key: 'blog/a.jpg' }),
        deleteByPublicUrl: async () => true,
      } as never,
    );
  });

  it('переставляет sortOrder среди переданных id (страница)', async () => {
    blogPost.findMany.mockResolvedValue([
      { id: 'a', sortOrder: 10 },
      { id: 'b', sortOrder: 20 },
    ]);
    blogPost.update.mockResolvedValue({});
    await service.reorderPosts({ orderedIds: ['b', 'a'] });
    expect(blogPost.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 10 },
    });
    expect(blogPost.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 20 },
    });
  });

  it('дубликаты → BadRequest', async () => {
    await expect(
      service.reorderPosts({ orderedIds: ['a', 'a'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('BlogAdminService.reorderCategories', () => {
  let service: BlogAdminService;

  beforeEach(() => {
    blogCategory.findMany.mockReset();
    blogCategory.update = vi.fn().mockResolvedValue({});
    tx.mockClear();
    service = new BlogAdminService(
      { blogPost, blogCategory, $transaction: tx } as never,
      {
        tryPublicUrlToKey: () => 'blog/x.jpg',
        saveImage: async () => ({ url: 'http://x/uploads/blog/a.jpg', key: 'blog/a.jpg' }),
        deleteByPublicUrl: async () => true,
      } as never,
    );
  });

  it('переставляет sortOrder всех рубрик', async () => {
    blogCategory.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await service.reorderCategories(['b', 'a']);
    expect(blogCategory.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
    expect(blogCategory.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
  });

  it('неполный список → BadRequest', async () => {
    blogCategory.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(service.reorderCategories(['a'])).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('BlogAdminService.createPost sanitize', () => {
  let service: BlogAdminService;

  beforeEach(() => {
    blogPost.findFirst.mockReset();
    blogPost.create.mockReset();
    blogPost.aggregate.mockReset();
    blogCategory.findUnique.mockReset();
    service = new BlogAdminService(
      { blogPost, blogCategory, $transaction: tx } as never,
      {
        tryPublicUrlToKey: () => 'blog/x.jpg',
        saveImage: async () => ({ url: 'http://x/uploads/blog/a.jpg', key: 'blog/a.jpg' }),
        deleteByPublicUrl: async () => true,
      } as never,
    );
  });

  it('санитизирует body и выставляет publishedAt при publish', async () => {
    blogPost.findFirst.mockResolvedValue(null);
    blogPost.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    blogPost.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
    await service.createPost({
      title: 'T',
      body: '<p>x</p><script>alert(1)</script>',
      excerpt: '<p>e</p><img src="x">',
      isPublished: true,
      publishedAt: null,
    });
    const data = blogPost.create.mock.calls[0]![0].data;
    expect(String(data.body)).not.toMatch(/script/i);
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.isPublished).toBe(true);
  });
});
