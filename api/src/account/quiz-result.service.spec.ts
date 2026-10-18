import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { QuizResultService } from './quiz-result.service';

describe('QuizResultService', () => {
  const prisma = {
    userQuizResult: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };

  const svc = new QuizResultService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get → null when no row', async () => {
    prisma.userQuizResult.findUnique.mockResolvedValue(null);
    await expect(svc.get('u1')).resolves.toEqual({ result: null });
  });

  it('get → maps row to payload', async () => {
    prisma.userQuizResult.findUnique.mockResolvedValue({
      version: 1,
      zone: 'face',
      answers: { skin_age: 'young', skin_issues: ['comedones'] },
      result: { priority: 1, blockKeys: ['a'] },
      completedAt: new Date('2026-09-01T10:00:00.000Z'),
    });

    await expect(svc.get('u1')).resolves.toEqual({
      result: {
        version: 1,
        zone: 'face',
        completedAt: '2026-09-01T10:00:00.000Z',
        answers: { skin_age: 'young', skin_issues: ['comedones'] },
        result: { priority: 1, blockKeys: ['a'] },
      },
    });
  });

  it('upsert → rejects bad completedAt', async () => {
    await expect(
      svc.upsert('u1', {
        version: 1,
        zone: 'face',
        completedAt: 'not-a-date',
        answers: { skin_age: 'young' },
        result: { priority: null, blockKeys: [] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upsert → writes and returns payload', async () => {
    prisma.userQuizResult.upsert.mockResolvedValue({
      version: 1,
      zone: 'face',
      answers: { skin_age: 'mature' },
      result: { priority: 2, blockKeys: ['x', 'y'] },
      completedAt: new Date('2026-09-01T12:00:00.000Z'),
    });

    const res = await svc.upsert('u1', {
      version: 1,
      zone: 'face',
      completedAt: '2026-09-01T12:00:00.000Z',
      answers: { skin_age: 'mature' },
      result: { priority: 2, blockKeys: ['x', 'y'] },
    });

    expect(prisma.userQuizResult.upsert).toHaveBeenCalledOnce();
    expect(res.result.completedAt).toBe('2026-09-01T12:00:00.000Z');
    expect(res.result.result.blockKeys).toEqual(['x', 'y']);
  });
});
