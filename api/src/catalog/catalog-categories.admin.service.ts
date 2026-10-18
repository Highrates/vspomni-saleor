import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from './slug.util';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/catalog-admin.dto';
import { trimOrNull } from './catalog-admin.helpers';

@Injectable()
export class CatalogCategoriesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** 0 = корень; максимум глубина 2 (корень → под → под-под). */
  private readonly maxCategoryDepthFromRoot = 2;

  async listCategories() {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true, products: true } },
      },
    });
    const depthById = await this.buildCategoryDepthMap(rows.map((r) => r.id));
    return rows.map((r) => this.serializeCategoryListRow(r, depthById.get(r.id) ?? 0));
  }

  async getCategory(id: string) {
    const r = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true, products: true } },
      },
    });
    if (!r) throw new NotFoundException('Категория не найдена');
    const depth = await this.computeCategoryDepthFromRoot(id);
    return this.serializeCategoryListRow(r, depth);
  }

  private serializeCategoryListRow(
    r: {
      id: string;
      name: string;
      slug: string;
      coverImageUrl: string | null;
      sortOrder: number;
      parentId: string | null;
      parent: { id: string; name: string; slug: string } | null;
      createdAt: Date;
      updatedAt: Date;
      _count: { children: number; products: number };
    },
    depthFromRoot: number,
  ) {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      coverImageUrl: r.coverImageUrl,
      sortOrder: r.sortOrder,
      parentId: r.parentId,
      parent: r.parent,
      depthFromRoot,
      childrenCount: r._count.children,
      productCount: r._count.products,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async createCategory(dto: CreateCategoryDto) {
    const parentId = dto.parentId?.trim() || null;
    if (parentId) await this.assertParentAllowsChildCategory(parentId);

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const agg = await this.prisma.category.aggregate({
        where: { parentId },
        _max: { sortOrder: true },
      });
      sortOrder = (agg._max.sortOrder ?? -1) + 1;
    }

    const slug = await this.uniqueCategorySlug(slugify(dto.name));
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder,
        parentId,
        coverImageUrl: dto.coverImageUrl === undefined ? undefined : trimOrNull(dto.coverImageUrl),
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      data.slug = await this.uniqueCategorySlug(slugify(dto.name), id);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = trimOrNull(dto.coverImageUrl);
    }
    if (dto.parentId !== undefined) {
      const newPid = dto.parentId?.trim() || null;
      if (newPid === id) throw new BadRequestException('Категория не может быть родителем сама себе');
      if (newPid) {
        await this.assertParentAllowsChildCategory(newPid);
        const descendantIds = await this.collectDescendantIds(id);
        if (descendantIds.has(newPid)) {
          throw new BadRequestException('Нельзя перенести категорию в собственного потомка');
        }
      }
      data.parent = newPid ? { connect: { id: newPid } } : { disconnect: true };
    }
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const cat = await this.requireCategory(id);
    const childCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictException(
        `Категория «${cat.name}» содержит подкатегории. Сначала удалите или перенесите их.`,
      );
    }
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ConflictException(
        `Категория «${cat.name}» используется в ${count} товар(ах). Сначала перенесите или удалите товары.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  async reorderCategories(parentId: string | null | undefined, orderedIds: string[]) {
    const pid = parentId?.trim() || null;
    const siblings = await this.prisma.category.findMany({
      where: { parentId: pid },
      select: { id: true },
    });
    const siblingIds = new Set(siblings.map((s) => s.id));
    if (orderedIds.length !== siblingIds.size || orderedIds.some((id) => !siblingIds.has(id))) {
      throw new BadRequestException('orderedIds должны содержать все категории этого уровня ровно по разу');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        this.prisma.category.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { ok: true };
  }

  async requireCategory(id: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Категория не найдена');
    return cat;
  }

  private async computeCategoryDepthFromRoot(id: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = id;
    const seen = new Set<string>();
    while (currentId) {
      if (seen.has(currentId)) break;
      seen.add(currentId);
      const row: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!row?.parentId) break;
      depth += 1;
      currentId = row.parentId;
      if (depth > this.maxCategoryDepthFromRoot + 2) break;
    }
    return depth;
  }

  private async buildCategoryDepthMap(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    await Promise.all(
      ids.map(async (id) => {
        map.set(id, await this.computeCategoryDepthFromRoot(id));
      }),
    );
    return map;
  }

  private async assertParentAllowsChildCategory(parentId: string): Promise<void> {
    await this.requireCategory(parentId);
    const d = await this.computeCategoryDepthFromRoot(parentId);
    if (d > this.maxCategoryDepthFromRoot - 1) {
      throw new BadRequestException(
        `Нельзя создать подкатегорию: достигнута максимальная глубина (${this.maxCategoryDepthFromRoot + 1} уровня)`,
      );
    }
  }

  private async collectDescendantIds(rootId: string): Promise<Set<string>> {
    const out = new Set<string>();
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      const children = await this.prisma.category.findMany({
        where: { parentId: id },
        select: { id: true },
      });
      for (const c of children) {
        if (out.has(c.id)) continue;
        out.add(c.id);
        queue.push(c.id);
      }
    }
    return out;
  }

  private async uniqueCategorySlug(base: string, excludeId?: string) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await this.prisma.category.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) return slug;
      slug = `${base}-${n++}`;
    }
  }
}
