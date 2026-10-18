import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersAdminService } from './users-admin.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed'),
}));

function makePrisma() {
  return {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    userAddress: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    userQuizResult: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    quizEvent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    order: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('UsersAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: UsersAdminService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new UsersAdminService(prisma as never);
  });

  it('listRetailUsers возвращает page/limit и orderCount', async () => {
    prisma.$transaction.mockResolvedValue([
      1,
      [
        {
          id: 'u1',
          email: 'a@b.c',
          displayName: 'Анна',
          isActive: true,
          createdAt: new Date('2026-01-01'),
          _count: { orders: 3 },
        },
      ],
    ]);

    const res = await svc.listRetailUsers({ page: 1, limit: 20 });
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({
      id: 'u1',
      email: 'a@b.c',
      displayName: 'Анна',
      orderCount: 3,
    });
  });

  it('getRetailUser → NotFound для админа / неактивного', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(svc.getRetailUser('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getRetailUser включает quiz saved + funnel', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      displayName: 'Анна',
      phone: null,
      birthday: null,
      marketingConsent: false,
      marketingConsentAt: null,
      privacyConsentAt: null,
      isActive: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      _count: { orders: 0 },
      addresses: [],
    });
    prisma.userQuizResult.findUnique.mockResolvedValue({
      version: 1,
      zone: 'face',
      answers: { skin_age: 'young', spf: 'yes', skin_issues: ['comedones'], skin_tasks: ['dryness'], swelling: 'no' },
      result: { priority: 1, blockKeys: ['step_1_spf'] },
      completedAt: new Date('2026-08-01T12:00:00.000Z'),
      updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    prisma.quizEvent.findMany.mockResolvedValue([
      {
        type: 'quiz_complete',
        zone: 'face',
        stepKey: 'result',
        sessionId: 's1',
        meta: { blockKeys: ['step_1_spf'] },
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
      },
      {
        type: 'step_view',
        zone: 'face',
        stepKey: 'age',
        sessionId: 's1',
        meta: null,
        createdAt: new Date('2026-08-01T11:55:00.000Z'),
      },
      {
        type: 'quiz_start',
        zone: null,
        stepKey: null,
        sessionId: 's1',
        meta: null,
        createdAt: new Date('2026-08-01T11:50:00.000Z'),
      },
    ]);

    const res = await svc.getRetailUser('u1');
    expect(res.quiz.saved?.result.blockKeys).toEqual(['step_1_spf']);
    expect(res.quiz.stats.sessionsCount).toBe(1);
    expect(res.quiz.stats.eventsCount).toBe(3);
    expect(res.quiz.funnel.find((s) => s.key === 'start')?.viewed).toBe(true);
    expect(res.quiz.funnel.find((s) => s.key === 'age')?.viewed).toBe(true);
    expect(res.quiz.funnel.find((s) => s.key === 'result')?.completed).toBe(true);
  });

  it('deleteRetailUser деактивирует и анонимизирует PII', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', isActive: true });
    prisma.user.update.mockResolvedValue({});

    await expect(svc.deleteRetailUser('u1')).resolves.toEqual({ ok: true });
    expect(prisma.userAddress.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.userQuizResult.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          isActive: false,
          email: 'deleted-u1@deleted.jcos.local',
          displayName: null,
          phone: null,
          marketingConsent: false,
          marketingConsentAt: null,
          marketingConsentVersion: null,
          passwordHash: 'hashed',
        }),
      }),
    );
  });

  it('deleteRetailUser отклоняет уже удалённого', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', isActive: false });
    await expect(svc.deleteRetailUser('u1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
