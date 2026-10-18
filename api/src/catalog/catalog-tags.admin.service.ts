import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { slugify } from './slug.util';
import { trimOrNull } from './catalog-admin.helpers';
import type { CreateCatalogTagDto, UpdateCatalogTagDto } from './dto/catalog-admin.dto';

const catalogTagInclude = {
  _count: { select: { products: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  steps: { orderBy: { sortOrder: 'asc' as const } },
};

type CatalogTagRow = Prisma.CatalogTagGetPayload<{ include: typeof catalogTagInclude }>;

@Injectable()
export class CatalogTagsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  async listCatalogTags() {
    const rows = await this.prisma.catalogTag.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: catalogTagInclude,
    });
    return rows.map((r) => this.serializeCatalogTag(r));
  }

  async getCatalogTag(id: string) {
    const r = await this.prisma.catalogTag.findUnique({
      where: { id },
      include: catalogTagInclude,
    });
    if (!r) throw new NotFoundException('Тег не найден');
    return this.serializeCatalogTag(r);
  }

  private serializeCatalogTag(r: CatalogTagRow) {
    const images = r.images.map((img) => ({
      id: img.id,
      url: img.url,
      sortOrder: img.sortOrder,
    }));
    const steps = r.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      sortOrder: step.sortOrder,
    }));
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      coverImageUrl: images[0]?.url ?? r.coverImageUrl,
      sortOrder: r.sortOrder,
      productCount: r._count.products,
      images,
      steps,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async createCatalogTag(dto: CreateCatalogTagDto) {
    const slug = await this.uniqueCatalogTagSlug(
      dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name),
    );
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const agg = await this.prisma.catalogTag.aggregate({ _max: { sortOrder: true } });
      sortOrder = (agg._max.sortOrder ?? -1) + 1;
    }
    return this.serializeCatalogTag(
      await this.prisma.catalogTag.create({
        data: {
          name: dto.name.trim(),
          slug,
          coverImageUrl: trimOrNull(dto.coverImageUrl),
          sortOrder,
        },
        include: catalogTagInclude,
      }),
    );
  }

  async updateCatalogTag(id: string, dto: UpdateCatalogTagDto) {
    await this.requireCatalogTag(id);
    const data: Prisma.CatalogTagUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) {
      data.slug = await this.uniqueCatalogTagSlug(slugify(dto.slug), id);
    } else if (dto.name !== undefined) {
      data.slug = await this.uniqueCatalogTagSlug(slugify(dto.name), id);
    }
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = trimOrNull(dto.coverImageUrl);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    if (dto.steps !== undefined) {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.catalogTag.update({ where: { id }, data });
        }
        await tx.catalogTagStep.deleteMany({ where: { tagId: id } });
        const steps = dto.steps!.filter((s) => s.title.trim());
        if (steps.length > 0) {
          await tx.catalogTagStep.createMany({
            data: steps.map((s, sortOrder) => ({
              tagId: id,
              title: s.title.trim(),
              description: s.description.trim(),
              sortOrder,
            })),
          });
        }
      });
    } else if (Object.keys(data).length > 0) {
      await this.prisma.catalogTag.update({ where: { id }, data });
    }

    return this.getCatalogTag(id);
  }

  async deleteCatalogTag(id: string) {
    await this.requireCatalogTag(id);
    await this.prisma.catalogTag.delete({ where: { id } });
    return { ok: true };
  }

  async reorderCatalogTags(orderedIds: string[]) {
    const all = await this.prisma.catalogTag.findMany({ select: { id: true } });
    const allIds = new Set(all.map((t) => t.id));
    if (orderedIds.length !== allIds.size || orderedIds.some((id) => !allIds.has(id))) {
      throw new BadRequestException('orderedIds должны содержать все теги ровно по разу');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        this.prisma.catalogTag.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { ok: true };
  }

  async uploadCatalogTagImage(
    tagId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    await this.requireCatalogTag(tagId);

    const { url } = await this.storage.saveGalleryMedia(file, `catalog-tags/${tagId}`);
    const maxSort = await this.prisma.catalogTagImage.aggregate({
      where: { tagId },
      _max: { sortOrder: true },
    });
    const image = await this.prisma.catalogTagImage.create({
      data: {
        tagId,
        url,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    await this.syncCoverImageUrl(tagId);
    return { id: image.id, url: image.url, sortOrder: image.sortOrder };
  }

  async reorderCatalogTagImages(tagId: string, imageIds: string[]) {
    const tag = await this.prisma.catalogTag.findUnique({
      where: { id: tagId },
      include: { images: true },
    });
    if (!tag) throw new NotFoundException('Тег не найден');
    const existing = new Set(tag.images.map((i) => i.id));
    if (imageIds.length !== existing.size || imageIds.some((id) => !existing.has(id))) {
      throw new BadRequestException('Список imageIds должен совпадать с картинками тега');
    }
    await this.prisma.$transaction(
      imageIds.map((id, sortOrder) =>
        this.prisma.catalogTagImage.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    await this.syncCoverImageUrl(tagId);
    return this.getCatalogTag(tagId);
  }

  async deleteCatalogTagImage(imageId: string) {
    const image = await this.prisma.catalogTagImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Изображение не найдено');
    await this.prisma.catalogTagImage.delete({ where: { id: imageId } });
    await this.storage.deleteByPublicUrl(image.url);
    await this.syncCoverImageUrl(image.tagId);
    return { ok: true };
  }

  private async syncCoverImageUrl(tagId: string) {
    const first = await this.prisma.catalogTagImage.findFirst({
      where: { tagId },
      orderBy: { sortOrder: 'asc' },
      select: { url: true },
    });
    await this.prisma.catalogTag.update({
      where: { id: tagId },
      data: { coverImageUrl: first?.url ?? null },
    });
  }

  private async requireCatalogTag(id: string) {
    const tag = await this.prisma.catalogTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Тег не найден');
    return tag;
  }

  private async uniqueCatalogTagSlug(base: string, excludeId?: string) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await this.prisma.catalogTag.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) return slug;
      slug = `${base}-${n++}`;
    }
  }
}
