import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountRewardType, DiscountScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dedupeIdsPreserveOrder, trimOrNull } from '../catalog/catalog-admin.helpers';
import {
  type CreateDiscountDto,
  type DiscountRuleInputDto,
  type UpdateDiscountDto,
} from './dto/discounts-admin.dto';
import { deriveDiscountStatus, discountStatusWhere } from './discount-status.util';
import {
  assertRewardValue,
  DiscountConditionsError,
  normalizeConditions,
} from './discount-conditions.util';

const LIST_DEFAULT = 20;
const LIST_MAX = 100;

function conditionsToPrismaJson(
  conditions: ReturnType<typeof normalizeConditions>,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (conditions === null) return Prisma.DbNull;
  return conditions as unknown as Prisma.InputJsonValue;
}

const discountInclude = {
  categories: {
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          parent: { select: { id: true, name: true } },
        },
      },
    },
  },
  products: {
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
  },
  rules: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.DiscountInclude;

type DiscountRow = Prisma.DiscountGetPayload<{ include: typeof discountInclude }>;

@Injectable()
export class DiscountsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    opts: {
      q?: string;
      page?: number;
      limit?: number;
      active?: boolean;
      scope?: DiscountScope;
      live?: boolean;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(LIST_MAX, Math.max(1, opts.limit ?? LIST_DEFAULT));
    const now = new Date();
    const where: Prisma.DiscountWhereInput = {};
    const and: Prisma.DiscountWhereInput[] = [];

    const q = opts.q?.trim();
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (opts.live) {
      and.push(discountStatusWhere('RUNNING', now));
    } else if (opts.active !== undefined) {
      and.push({ active: opts.active });
    }

    if (opts.scope) {
      and.push({ scope: opts.scope });
    }

    if (and.length) where.AND = and;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.discount.count({ where }),
      this.prisma.discount.findMany({
        where,
        include: { _count: { select: { rules: true } } },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        scope: r.scope,
        active: r.active,
        status: deriveDiscountStatus({
          active: r.active,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          ruleCount: r._count.rules,
        }),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        ruleCount: r._count.rules,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async get(id: string) {
    const row = await this.prisma.discount.findUnique({
      where: { id },
      include: discountInclude,
    });
    if (!row) throw new NotFoundException('Скидка не найдена');
    return this.serialize(row);
  }

  async create(dto: CreateDiscountDto) {
    const prepared = await this.preparePayload(dto);
    const row = await this.prisma.discount.create({
      data: {
        name: prepared.name,
        description: prepared.description,
        scope: prepared.scope,
        active: prepared.active,
        startsAt: prepared.startsAt,
        endsAt: prepared.endsAt,
        categories:
          prepared.scope === DiscountScope.CATEGORY
            ? { create: prepared.categoryIds.map((categoryId) => ({ categoryId })) }
            : undefined,
        products:
          prepared.scope === DiscountScope.PRODUCTS
            ? { create: prepared.productIds.map((productId) => ({ productId })) }
            : undefined,
        rules: {
          create: prepared.rules.map(({ id: _ruleId, ...rule }, sortOrder) => ({
            name: rule.name,
            conditions: conditionsToPrismaJson(rule.conditions),
            description: rule.description,
            rewardType: rule.rewardType,
            rewardValue: rule.rewardValue,
            sortOrder,
          })),
        },
      },
      include: discountInclude,
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateDiscountDto) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Скидка не найдена');

    // Форма шлёт полный снимок; собираем Create-совместимый payload.
    const full: CreateDiscountDto = {
      name: dto.name ?? existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      scope: dto.scope ?? existing.scope,
      active: dto.active ?? existing.active,
      startsAt: dto.startsAt ?? existing.startsAt.toISOString(),
      endsAt:
        dto.endsAt !== undefined
          ? dto.endsAt
          : existing.endsAt
            ? existing.endsAt.toISOString()
            : null,
      categoryIds: dto.categoryIds,
      productIds: dto.productIds,
      rules: dto.rules,
    };

    if (dto.categoryIds === undefined && full.scope === DiscountScope.CATEGORY) {
      const links = await this.prisma.discountCategory.findMany({
        where: { discountId: id },
        select: { categoryId: true },
      });
      full.categoryIds = links.map((l) => l.categoryId);
    }
    if (dto.productIds === undefined && full.scope === DiscountScope.PRODUCTS) {
      const links = await this.prisma.discountProduct.findMany({
        where: { discountId: id },
        select: { productId: true },
      });
      full.productIds = links.map((l) => l.productId);
    }
    if (dto.rules === undefined) {
      const rules = await this.prisma.discountRule.findMany({
        where: { discountId: id },
        orderBy: { sortOrder: 'asc' },
      });
      full.rules = rules.map((r) => ({
        id: r.id,
        name: r.name,
        conditions: (r.conditions as DiscountRuleInputDto['conditions']) ?? null,
        description: r.description,
        rewardType: r.rewardType,
        rewardValue: r.rewardValue,
      }));
    }

    const prepared = await this.preparePayload(full);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.discount.update({
        where: { id },
        data: {
          name: prepared.name,
          description: prepared.description,
          scope: prepared.scope,
          active: prepared.active,
          startsAt: prepared.startsAt,
          endsAt: prepared.endsAt,
        },
      });

      if (prepared.scope === DiscountScope.CATEGORY) {
        await tx.discountProduct.deleteMany({ where: { discountId: id } });
        await this.syncCategoryLinks(tx, id, prepared.categoryIds);
      } else {
        await tx.discountCategory.deleteMany({ where: { discountId: id } });
        await this.syncProductLinks(tx, id, prepared.productIds);
      }

      await this.syncRules(tx, id, prepared.rules);

      return tx.discount.findUniqueOrThrow({
        where: { id },
        include: discountInclude,
      });
    });

    return this.serialize(row);
  }

  async delete(id: string) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Скидка не найдена');
    await this.prisma.discount.delete({ where: { id } });
    return { ok: true };
  }

  private serialize(row: DiscountRow) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      scope: row.scope,
      active: row.active,
      status: deriveDiscountStatus({
        active: row.active,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        ruleCount: row.rules.length,
      }),
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      categoryIds: row.categories.map((c) => c.categoryId),
      categories: row.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        slug: c.category.slug,
        parentId: c.category.parentId,
        parentName: c.category.parent?.name ?? null,
      })),
      productIds: row.products.map((p) => p.productId),
      products: row.products.map((p) => ({
        id: p.product.id,
        name: p.product.name,
        slug: p.product.slug,
      })),
      rules: row.rules.map((r) => ({
        id: r.id,
        name: r.name,
        conditions: r.conditions,
        description: r.description,
        rewardType: r.rewardType,
        rewardValue: r.rewardValue,
        sortOrder: r.sortOrder,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async syncCategoryLinks(
    tx: Prisma.TransactionClient,
    discountId: string,
    categoryIds: string[],
  ) {
    if (!categoryIds.length) {
      await tx.discountCategory.deleteMany({ where: { discountId } });
      return;
    }
    await tx.discountCategory.deleteMany({
      where: { discountId, categoryId: { notIn: categoryIds } },
    });
    const existing = await tx.discountCategory.findMany({
      where: { discountId },
      select: { categoryId: true },
    });
    const have = new Set(existing.map((e) => e.categoryId));
    const toCreate = categoryIds.filter((categoryId) => !have.has(categoryId));
    if (toCreate.length) {
      await tx.discountCategory.createMany({
        data: toCreate.map((categoryId) => ({ discountId, categoryId })),
        skipDuplicates: true,
      });
    }
  }

  private async syncProductLinks(
    tx: Prisma.TransactionClient,
    discountId: string,
    productIds: string[],
  ) {
    if (!productIds.length) {
      await tx.discountProduct.deleteMany({ where: { discountId } });
      return;
    }
    await tx.discountProduct.deleteMany({
      where: { discountId, productId: { notIn: productIds } },
    });
    const existing = await tx.discountProduct.findMany({
      where: { discountId },
      select: { productId: true },
    });
    const have = new Set(existing.map((e) => e.productId));
    const toCreate = productIds.filter((productId) => !have.has(productId));
    if (toCreate.length) {
      await tx.discountProduct.createMany({
        data: toCreate.map((productId) => ({ discountId, productId })),
        skipDuplicates: true,
      });
    }
  }

  private async syncRules(
    tx: Prisma.TransactionClient,
    discountId: string,
    rules: ReturnType<DiscountsAdminService['normalizeRules']>,
  ) {
    const existing = await tx.discountRule.findMany({
      where: { discountId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((r) => r.id));

    for (const rule of rules) {
      if (rule.id && !existingIds.has(rule.id)) {
        throw new BadRequestException(`Правило «${rule.name}»: неизвестный id`);
      }
    }

    const keepIds = rules.map((r) => r.id).filter((id): id is string => Boolean(id));
    await tx.discountRule.deleteMany({
      where: {
        discountId,
        ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
      },
    });

    for (let sortOrder = 0; sortOrder < rules.length; sortOrder++) {
      const rule = rules[sortOrder]!;
      const data = {
        name: rule.name,
        conditions: conditionsToPrismaJson(rule.conditions),
        description: rule.description,
        rewardType: rule.rewardType,
        rewardValue: rule.rewardValue,
        sortOrder,
      };
      if (rule.id) {
        await tx.discountRule.update({
          where: { id: rule.id },
          data,
        });
      } else {
        await tx.discountRule.create({
          data: { discountId, ...data },
        });
      }
    }
  }

  private async preparePayload(dto: CreateDiscountDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Укажите название');

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Некорректная дата начала');
    }

    let endsAt: Date | null = null;
    if (dto.endsAt != null && String(dto.endsAt).trim() !== '') {
      endsAt = new Date(dto.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException('Некорректная дата окончания');
      }
      if (endsAt.getTime() < startsAt.getTime()) {
        throw new BadRequestException('Дата окончания не может быть раньше начала');
      }
    }

    const categoryIds = dedupeIdsPreserveOrder(dto.categoryIds ?? []);
    const productIds = dedupeIdsPreserveOrder(dto.productIds ?? []);

    if (dto.scope === DiscountScope.CATEGORY) {
      if (!categoryIds.length) {
        throw new BadRequestException('Выберите категорию или подкатегорию');
      }
      const n = await this.prisma.category.count({ where: { id: { in: categoryIds } } });
      if (n !== categoryIds.length) {
        throw new BadRequestException('Одна из категорий не найдена');
      }
    } else {
      if (!productIds.length) {
        throw new BadRequestException('Выберите хотя бы один товар');
      }
      const n = await this.prisma.product.count({ where: { id: { in: productIds } } });
      if (n !== productIds.length) {
        throw new BadRequestException('Один из товаров не найден');
      }
    }

    return {
      name,
      description: trimOrNull(dto.description),
      scope: dto.scope,
      active: dto.active ?? true,
      startsAt,
      endsAt,
      categoryIds: dto.scope === DiscountScope.CATEGORY ? categoryIds : [],
      productIds: dto.scope === DiscountScope.PRODUCTS ? productIds : [],
      rules: this.normalizeRules(dto.rules ?? []),
    };
  }

  private normalizeRules(rules: DiscountRuleInputDto[]) {
    return rules.map((r, i) => {
      const name = r.name?.trim();
      if (!name) throw new BadRequestException(`Правило #${i + 1}: укажите название`);
      const err = assertRewardValue(r.rewardType, r.rewardValue);
      if (err) throw new BadRequestException(`Правило «${name}»: ${err}`);
      const id = r.id?.trim() || undefined;
      let conditions;
      try {
        conditions = normalizeConditions(r.conditions ?? null);
      } catch (e) {
        const msg =
          e instanceof DiscountConditionsError ? e.message : 'Некорректные условия';
        throw new BadRequestException(`Правило «${name}»: ${msg}`);
      }
      return {
        id,
        name,
        conditions,
        description: trimOrNull(r.description),
        rewardType: r.rewardType as DiscountRewardType,
        rewardValue: r.rewardValue,
      };
    });
  }
}
