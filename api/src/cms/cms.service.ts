import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { extractMediaUrlsFromRichHtml } from '../blog/blog-html.util';
import { sanitizeProductRichHtml } from '../catalog/catalog-html.util';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import type { UpdateCmsPageDto } from './dto/cms-page.dto';

export const LEGAL_SLUGS = ['privacy', 'terms', 'delivery'] as const;
export const ABOUT_SLUG = 'about' as const;
export const CMS_PAGE_SLUGS = [...LEGAL_SLUGS, ABOUT_SLUG] as const;

function isCmsPageSlug(slug: string): slug is (typeof CMS_PAGE_SLUGS)[number] {
  return (CMS_PAGE_SLUGS as readonly string[]).includes(slug);
}

function defaultTitle(slug: (typeof CMS_PAGE_SLUGS)[number]): string {
  if (slug === 'privacy') return 'Политика конфиденциальности';
  if (slug === 'terms') return 'Оферта и условия пользования';
  if (slug === 'delivery') return 'Оплата и доставка';
  return 'О нас';
}

function serialize(row: {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    bodyHtml: row.bodyHtml,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function syntheticCmsPage(slug: (typeof CMS_PAGE_SLUGS)[number]) {
  return {
    id: null as string | null,
    slug,
    title: defaultTitle(slug),
    bodyHtml: '<p></p>',
    isPublished: false,
    publishedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

@Injectable()
export class CmsAdminService {
  private readonly logger = new Logger(CmsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  async listLegal() {
    const rows = await this.prisma.cmsPage.findMany({
      where: { slug: { in: [...LEGAL_SLUGS] } },
      orderBy: { slug: 'asc' },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return {
      items: LEGAL_SLUGS.map((slug) => {
        const row = bySlug.get(slug);
        return row ? serialize(row) : syntheticCmsPage(slug);
      }),
    };
  }

  async listAbout() {
    const row = await this.prisma.cmsPage.findUnique({
      where: { slug: ABOUT_SLUG },
    });
    return {
      item: row ? serialize(row) : syntheticCmsPage(ABOUT_SLUG),
    };
  }

  async getBySlug(slug: string) {
    if (!isCmsPageSlug(slug)) {
      throw new NotFoundException('Страница не найдена');
    }
    const row = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (row) return serialize(row);
    return syntheticCmsPage(slug);
  }

  async updateBySlug(slug: string, dto: UpdateCmsPageDto) {
    if (!isCmsPageSlug(slug)) {
      throw new BadRequestException('Недопустимый slug CMS-страницы');
    }

    const existing = await this.prisma.cmsPage.findUnique({ where: { slug } });
    const isPublished = dto.isPublished ?? existing?.isPublished ?? true;
    const bodyHtml =
      sanitizeProductRichHtml(dto.bodyHtml.trim() || '<p></p>').trim() || '<p></p>';
    const data = {
      title: dto.title.trim(),
      bodyHtml,
      isPublished,
      publishedAt: isPublished
        ? (existing?.publishedAt ?? new Date())
        : existing?.publishedAt ?? null,
    };

    const row = existing
      ? await this.prisma.cmsPage.update({ where: { slug }, data })
      : await this.prisma.cmsPage.create({
          data: { slug, ...data },
        });

    if (existing?.bodyHtml) {
      const prevUrls = new Set(extractMediaUrlsFromRichHtml(existing.bodyHtml));
      const nextUrls = new Set(extractMediaUrlsFromRichHtml(bodyHtml));
      const toRemove = [...prevUrls].filter((u) => !nextUrls.has(u));
      if (toRemove.length) {
        void this.discardCmsUploads(toRemove).catch((e) =>
          this.logger.warn(
            `cms media cleanup: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      }
    }

    return serialize(row);
  }

  /**
   * Удаляет локальные /uploads/… из Quill юр. страниц, если URL больше
   * не числится в CmsPage / cart legal / product rich HTML.
   */
  async discardCmsUploads(urls: string[]) {
    const candidates = [
      ...new Set(
        (urls ?? [])
          .map((u) => String(u ?? '').trim())
          .filter((u) => Boolean(u) && Boolean(this.storage.tryPublicUrlToKey(u))),
      ),
    ].slice(0, 50);

    if (!candidates.length) return { deleted: 0 };

    const referenced = await this.collectReferencedRichMediaUrls();
    let deleted = 0;
    for (const url of candidates) {
      if (referenced.has(url)) continue;
      try {
        const ok = await this.storage.deleteByPublicUrl(url);
        if (ok) deleted += 1;
      } catch (e) {
        this.logger.warn(
          `discardCmsUploads ${url}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return { deleted };
  }

  private async collectReferencedRichMediaUrls(): Promise<Set<string>> {
    const out = new Set<string>();

    const pages = await this.prisma.cmsPage.findMany({
      select: { bodyHtml: true },
    });
    for (const p of pages) {
      for (const u of extractMediaUrlsFromRichHtml(p.bodyHtml)) out.add(u);
    }

    const cart = await this.prisma.cartSettings.findUnique({
      where: { id: 'default' },
      select: { legalHtml: true },
    });
    for (const u of extractMediaUrlsFromRichHtml(cart?.legalHtml)) out.add(u);

    const products = await this.prisma.product.findMany({
      select: {
        descriptionHtml: true,
        applicationHtml: true,
        compositionHtml: true,
        storageHtml: true,
        extraHtml: true,
      },
    });
    for (const p of products) {
      for (const html of [
        p.descriptionHtml,
        p.applicationHtml,
        p.compositionHtml,
        p.storageHtml,
        p.extraHtml,
      ]) {
        for (const u of extractMediaUrlsFromRichHtml(html)) out.add(u);
      }
    }
    return out;
  }
}

@Injectable()
export class CmsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getBySlug(slug: string) {
    if (!isCmsPageSlug(slug)) {
      throw new NotFoundException('Страница не найдена');
    }
    const row = await this.prisma.cmsPage.findFirst({
      where: { slug, isPublished: true },
      select: {
        slug: true,
        title: true,
        bodyHtml: true,
        updatedAt: true,
      },
    });
    if (!row) throw new NotFoundException('Страница не найдена');
    return {
      slug: row.slug,
      title: row.title,
      bodyHtml: sanitizeProductRichHtml(row.bodyHtml),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
