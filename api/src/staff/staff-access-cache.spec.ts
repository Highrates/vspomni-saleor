import { describe, expect, it } from 'vitest';
import { InMemoryStaffAccessCache } from './staff-access-cache';
import { UserRole } from '@prisma/client';
import type { StaffAccessSnapshot } from './staff.types';

const snapshot: StaffAccessSnapshot = {
  role: UserRole.MODERATOR,
  isActive: true,
  staffDeletedAt: null,
  adminSections: ['orders'],
  staffDisplayName: null,
  staffAvatarUrl: null,
  tokenVersion: 1,
};

describe('InMemoryStaffAccessCache', () => {
  it('set/get/delete', async () => {
    const cache = new InMemoryStaffAccessCache();
    await cache.set('u1', { at: Date.now(), data: snapshot }, 30_000);
    expect(await cache.get('u1')).toEqual({ at: expect.any(Number), data: snapshot });
    await cache.delete('u1');
    expect(await cache.get('u1')).toBeNull();
  });
});
