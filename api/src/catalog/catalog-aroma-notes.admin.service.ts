import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { normalizeAromaNoteName, trimOrNull } from './catalog-admin.helpers';
import type {
  CreateAromaNoteDefinitionDto,
  UpdateAromaNoteDefinitionDto,
} from './dto/catalog-admin.dto';

@Injectable()
export class CatalogAromaNotesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  async listDefinitions(q?: string) {
    const query = (q ?? '').trim();
    const rows = await this.prisma.aromaNoteDefinition.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              {
                nameNormalized: {
                  contains: query.toLocaleLowerCase('ru'),
                },
              },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { productNotes: true } } },
    });
    return rows.map((r) => this.serialize(r));
  }

  async getDefinition(id: string) {
    const r = await this.prisma.aromaNoteDefinition.findUnique({
      where: { id },
      include: { _count: { select: { productNotes: true } } },
    });
    if (!r) throw new NotFoundException('Нота не найдена');
    return this.serialize(r);
  }

  async createDefinition(dto: CreateAromaNoteDefinitionDto) {
    const { name, nameNormalized } = normalizeAromaNoteName(dto.name);
    if (!name) throw new BadRequestException('Укажите название');
    const dup = await this.prisma.aromaNoteDefinition.findUnique({
      where: { nameNormalized },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException('Нота с таким названием уже есть');
    }
    try {
      const r = await this.prisma.aromaNoteDefinition.create({
        data: {
          name,
          nameNormalized,
          imageUrl: trimOrNull(dto.imageUrl),
        },
        include: { _count: { select: { productNotes: true } } },
      });
      return this.serialize(r);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Нота с таким названием уже есть');
      }
      throw e;
    }
  }

  async updateDefinition(id: string, dto: UpdateAromaNoteDefinitionDto) {
    const current = await this.prisma.aromaNoteDefinition.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Нота не найдена');

    const data: Prisma.AromaNoteDefinitionUpdateInput = {};
    if (dto.name !== undefined) {
      const { name, nameNormalized } = normalizeAromaNoteName(dto.name);
      if (!name) throw new BadRequestException('Укажите название');
      const dup = await this.prisma.aromaNoteDefinition.findFirst({
        where: {
          nameNormalized,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException('Нота с таким названием уже есть');
      }
      data.name = name;
      data.nameNormalized = nameNormalized;
    }

    let oldImage: string | null = null;
    if (dto.imageUrl !== undefined) {
      const next = trimOrNull(dto.imageUrl);
      if (current.imageUrl && current.imageUrl !== next) {
        oldImage = current.imageUrl;
      }
      data.imageUrl = next;
    }

    let r;
    try {
      r = await this.prisma.aromaNoteDefinition.update({
        where: { id },
        data,
        include: { _count: { select: { productNotes: true } } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Нота с таким названием уже есть');
      }
      throw e;
    }

    if (oldImage) {
      const stillUsed =
        (await this.prisma.productAromaNote.count({
          where: { imageUrl: oldImage },
        })) +
        (await this.prisma.aromaNoteDefinition.count({
          where: { imageUrl: oldImage },
        }));
      if (stillUsed === 0) {
        await this.storage.deleteManagedUpload(oldImage);
      }
    }

    return this.serialize(r);
  }

  async deleteDefinition(id: string) {
    const current = await this.prisma.aromaNoteDefinition.findUnique({
      where: { id },
      include: { _count: { select: { productNotes: true } } },
    });
    if (!current) throw new NotFoundException('Нота не найдена');
    if (current._count.productNotes > 0) {
      throw new ConflictException(
        `Нельзя удалить: нота используется в ${current._count.productNotes} привязках товаров`,
      );
    }
    await this.prisma.aromaNoteDefinition.delete({ where: { id } });
    if (current.imageUrl) {
      const stillUsed = await this.prisma.aromaNoteDefinition.count({
        where: { imageUrl: current.imageUrl },
      });
      const overrideUsed = await this.prisma.productAromaNote.count({
        where: { imageUrl: current.imageUrl },
      });
      if (stillUsed + overrideUsed === 0) {
        await this.storage.deleteManagedUpload(current.imageUrl);
      }
    }
    return { ok: true };
  }

  private serialize(
    r: Prisma.AromaNoteDefinitionGetPayload<{
      include: { _count: { select: { productNotes: true } } };
    }>,
  ) {
    return {
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      productCount: r._count.productNotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
