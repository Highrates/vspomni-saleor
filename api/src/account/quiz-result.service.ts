import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertQuizResultDto } from './dto/quiz-result.dto';

export type SavedQuizResultPayload = {
  version: 1;
  zone: 'face';
  completedAt: string;
  answers: Record<string, unknown>;
  result: {
    priority: number | null;
    blockKeys: string[];
  };
};

@Injectable()
export class QuizResultService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<{ result: SavedQuizResultPayload | null }> {
    const row = await this.prisma.userQuizResult.findUnique({
      where: { userId },
    });
    if (!row) return { result: null };
    return { result: this.toPayload(row) };
  }

  async upsert(
    userId: string,
    dto: UpsertQuizResultDto,
  ): Promise<{ result: SavedQuizResultPayload }> {
    const completedAt = this.parseCompletedAt(dto.completedAt);
    const answers = this.asJsonObject(dto.answers, 'answers');
    const resultMeta = {
      priority: dto.result.priority ?? null,
      blockKeys: dto.result.blockKeys.map((k) => k.trim()).filter(Boolean),
    };

    const row = await this.prisma.userQuizResult.upsert({
      where: { userId },
      create: {
        userId,
        version: dto.version,
        zone: dto.zone,
        answers,
        result: resultMeta as Prisma.InputJsonValue,
        completedAt,
      },
      update: {
        version: dto.version,
        zone: dto.zone,
        answers,
        result: resultMeta as Prisma.InputJsonValue,
        completedAt,
      },
    });

    return { result: this.toPayload(row) };
  }

  private parseCompletedAt(raw: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Некорректная дата completedAt');
    }
    return d;
  }

  private asJsonObject(
    value: Record<string, unknown>,
    field: string,
  ): Prisma.InputJsonValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`Поле ${field} должно быть объектом`);
    }
    return value as Prisma.InputJsonValue;
  }

  private toPayload(row: {
    version: number;
    zone: string;
    answers: Prisma.JsonValue;
    result: Prisma.JsonValue;
    completedAt: Date;
  }): SavedQuizResultPayload {
    const resultObj =
      row.result && typeof row.result === 'object' && !Array.isArray(row.result)
        ? (row.result as { priority?: unknown; blockKeys?: unknown })
        : {};
    const priority =
      typeof resultObj.priority === 'number'
        ? resultObj.priority
        : resultObj.priority === null
          ? null
          : null;
    const blockKeys = Array.isArray(resultObj.blockKeys)
      ? resultObj.blockKeys.filter((k): k is string => typeof k === 'string')
      : [];

    return {
      version: 1,
      zone: 'face',
      completedAt: row.completedAt.toISOString(),
      answers:
        row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers)
          ? (row.answers as Record<string, unknown>)
          : {},
      result: { priority, blockKeys },
    };
  }
}
