import { describe, expect, it } from 'vitest';
import { isAdminStaffRole } from './adminStaffRole';

describe('isAdminStaffRole', () => {
  it('пуcкает ADMIN и MODERATOR', () => {
    expect(isAdminStaffRole('ADMIN')).toBe(true);
    expect(isAdminStaffRole('MODERATOR')).toBe(true);
  });

  it('отклоняет buyer и пустое', () => {
    expect(isAdminStaffRole('USER')).toBe(false);
    expect(isAdminStaffRole(undefined)).toBe(false);
    expect(isAdminStaffRole('')).toBe(false);
  });
});
