import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_LIST_MAX_LIMIT } from './catalog.constants';
import { assertProductsExist, dedupeIdsPreserveOrder, trimOrNull } from './catalog-admin.helpers';
import { productSetInclude, serializeProductSet } from './catalog-admin.serializers';
import { slugify } from './slug.util';
import type { CreateProductSetDto, UpdateProductSetDto } from './dto/catalog-admin.dto';

@Injectable()
export class CatalogProductSetsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listProductSets(opts: { q?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(ADMIN_LIST_MAX_LIMIT, Math.max(1, opts.limit ?? 20));
    const where: Prisma.ProductSetWhereInput = {};
    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productSet.count({ where }),
      this.prisma.productSet.findMany({
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

  async getProductSet(id: string) {
    const row = await this.prisma.productSet.findUnique({
      where: { id },
      include: productSetInclude,
    });
    if (!row) throw new NotFoundException('Набор не найден');
    return serializeProductSet(row);
  }

  async createProductSet(dto: CreateProductSetDto) {
    const productIds = dedupeIdsPreserveOrder(dto.productIds ?? []);
    await assertProductsExist(this.prisma, productIds);
    const slug = await this.uniqueProductSetSlug(
      dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name),
    );

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productSet.create({
        data: {
          name: dto.name.trim(),
          slug,
          shortDescription: trimOrNull(dto.shortDescription),
          coverImageUrl: trimOrNull(dto.coverImageUrl),
          active: dto.active ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      if (productIds.length) {
        await tx.productSetItem.createMany({
          data: productIds.map((productId, sortOrder) => ({
            productSetId: created.id,
            productId,
            sortOrder,
          })),
        });
      }
      return tx.productSet.findUniqueOrThrow({
        where: { id: created.id },
        include: productSetInclude,
      });
    });
    return serializeProductSet(row);
  }

  async updateProductSet(id: string, dto: UpdateProductSetDto) {
    const existing = await this.prisma.productSet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Набор не найден');

    const productIds =
      dto.productIds !== undefined ? dedupeIdsPreserveOrder(dto.productIds) : undefined;
    if (productIds) await assertProductsExist(this.prisma, productIds);

    const data: Prisma.ProductSetUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) {
      data.slug = await this.uniqueProductSetSlug(slugify(dto.slug), id);
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.shortDescription !== undefined) {
      data.shortDescription = trimOrNull(dto.shortDescription);
    }
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = trimOrNull(dto.coverImageUrl);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.productSet.update({ where: { id }, data });
      if (productIds !== undefined) {
        await tx.productSetItem.deleteMany({ where: { productSetId: id } });
        if (productIds.length) {
          await tx.productSetItem.createMany({
            data: productIds.map((productId, sortOrder) => ({
              productSetId: id,
              productId,
              sortOrder,
            })),
          });
        }
      }
      return tx.productSet.findUniqueOrThrow({
        where: { id },
        include: productSetInclude,
      });
    });
    return serializeProductSet(row);
  }

  async deleteProductSet(id: string) {
    const existing = await this.prisma.productSet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Набор не найден');
    await this.prisma.productSet.delete({ where: { id } });
    return { ok: true };
  }

  async reorderProductSets(orderedIds: string[]) {
    const all = await this.prisma.productSet.findMany({ select: { id: true } });
    const allIds = new Set(all.map((t) => t.id));
    if (orderedIds.length !== allIds.size || orderedIds.some((id) => !allIds.has(id))) {
      throw new BadRequestException('orderedIds должны содержать все наборы ровно по разу');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        this.prisma.productSet.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { ok: true };
  }

  private async uniqueProductSetSlug(base: string, excludeId?: string) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await this.prisma.productSet.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) return slug;
      slug = `${base}-${n++}`;
    }
  }
}
