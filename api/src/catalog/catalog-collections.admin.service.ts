import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_LIST_MAX_LIMIT } from './catalog.constants';
import { assertProductsExist, dedupeIdsPreserveOrder, trimOrNull } from './catalog-admin.helpers';
import { collectionInclude, serializeCollection } from './catalog-admin.serializers';
import { slugify } from './slug.util';
import type { CreateCollectionDto, UpdateCollectionDto } from './dto/catalog-admin.dto';

@Injectable()
export class CatalogCollectionsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listCollections(opts: { q?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(ADMIN_LIST_MAX_LIMIT, Math.max(1, opts.limit ?? 20));
    const where: Prisma.CollectionWhereInput = {};
    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.collection.count({ where }),
      this.prisma.collection.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        active: r.active,
        featuredLayout: r.featuredLayout,
        sortOrder: r.sortOrder,
        itemCount: r._count.items,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getCollection(id: string) {
    const row = await this.prisma.collection.findUnique({
      where: { id },
      include: collectionInclude,
    });
    if (!row) throw new NotFoundException('Коллекция не найдена');
    return serializeCollection(row);
  }

  async createCollection(dto: CreateCollectionDto) {
    const productIds = dedupeIdsPreserveOrder(dto.productIds ?? []);
    await assertProductsExist(this.prisma, productIds);
    const slug = await this.uniqueCollectionSlug(
      dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name),
    );

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.collection.create({
        data: {
          name: dto.name.trim(),
          slug,
          shortDescription: trimOrNull(dto.shortDescription),
          coverImageUrl: trimOrNull(dto.coverImageUrl),
          productPreviewUrl: trimOrNull(dto.productPreviewUrl),
          active: dto.active ?? true,
          featuredLayout: dto.featuredLayout ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      if (productIds.length) {
        await tx.collectionItem.createMany({
          data: productIds.map((productId, sortOrder) => ({
            collectionId: created.id,
            productId,
            sortOrder,
          })),
        });
      }
      return tx.collection.findUniqueOrThrow({
        where: { id: created.id },
        include: collectionInclude,
      });
    });
    return serializeCollection(row);
  }

  async updateCollection(id: string, dto: UpdateCollectionDto) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Коллекция не найдена');

    const productIds =
      dto.productIds !== undefined ? dedupeIdsPreserveOrder(dto.productIds) : undefined;
    if (productIds) await assertProductsExist(this.prisma, productIds);

    const data: Prisma.CollectionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) {
      data.slug = await this.uniqueCollectionSlug(slugify(dto.slug), id);
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.featuredLayout !== undefined) data.featuredLayout = dto.featuredLayout;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.shortDescription !== undefined) {
      data.shortDescription = trimOrNull(dto.shortDescription);
    }
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = trimOrNull(dto.coverImageUrl);
    }
    if (dto.productPreviewUrl !== undefined) {
      data.productPreviewUrl = trimOrNull(dto.productPreviewUrl);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.collection.update({ where: { id }, data });
      if (productIds !== undefined) {
        await tx.collectionItem.deleteMany({ where: { collectionId: id } });
        if (productIds.length) {
          await tx.collectionItem.createMany({
            data: productIds.map((productId, sortOrder) => ({
              collectionId: id,
              productId,
              sortOrder,
            })),
          });
        }
      }
      return tx.collection.findUniqueOrThrow({
        where: { id },
        include: collectionInclude,
      });
    });
    return serializeCollection(row);
  }

  async deleteCollection(id: string) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Коллекция не найдена');
    await this.prisma.collection.delete({ where: { id } });
    return { ok: true };
  }

  async reorderCollections(orderedIds: string[]) {
    const all = await this.prisma.collection.findMany({ select: { id: true } });
    const allIds = new Set(all.map((t) => t.id));
    if (orderedIds.length !== allIds.size || orderedIds.some((id) => !allIds.has(id))) {
      throw new BadRequestException('orderedIds должны содержать все коллекции ровно по разу');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        this.prisma.collection.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { ok: true };
  }

  private async uniqueCollectionSlug(base: string, excludeId?: string) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await this.prisma.collection.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) return slug;
      slug = `${base}-${n++}`;
    }
  }
}
