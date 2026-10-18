import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatStaffLastLogin,
  isStaffDisplayNameDirty,
  normalizeStaffDisplayName,
  staffAvatarAltText,
} from './staffUtils';

describe('normalizeStaffDisplayName', () => {
  it('trim и пустая строка → null', () => {
    expect(normalizeStaffDisplayName('  ')).toBeNull();
    expect(normalizeStaffDisplayName('Anna')).toBe('Anna');
  });
});

describe('isStaffDisplayNameDirty', () => {
  it('false когда нормализованные значения совпадают', () => {
    expect(isStaffDisplayNameDirty('Anna', 'Anna')).toBe(false);
    expect(isStaffDisplayNameDirty('  Anna  ', 'Anna')).toBe(false);
    expect(isStaffDisplayNameDirty('', null)).toBe(false);
    expect(isStaffDisplayNameDirty('   ', null)).toBe(false);
  });

  it('true при изменении текста', () => {
    expect(isStaffDisplayNameDirty('Anna', 'Bob')).toBe(true);
    expect(isStaffDisplayNameDirty('Anna', null)).toBe(true);
    expect(isStaffDisplayNameDirty('', 'Anna')).toBe(true);
  });
});

describe('formatStaffLastLogin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('null → «никогда»', () => {
    expect(formatStaffLastLogin(null)).toBe('никогда');
  });

  it('валидный ISO → локализованная строка', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('15.06.2024, 15:30');
    expect(formatStaffLastLogin('2024-06-15T12:30:00.000Z')).toBe('15.06.2024, 15:30');
  });

  it('невалидный ISO → «—»', () => {
    expect(formatStaffLastLogin('not-a-date')).toBe('—');
  });
});

describe('staffAvatarAltText', () => {
  it('предпочитает displayName', () => {
    expect(staffAvatarAltText('Anna', 'a@b.c')).toBe('Аватар: Anna');
  });

  it('fallback на email', () => {
    expect(staffAvatarAltText('', 'a@b.c')).toBe('Аватар: a@b.c');
    expect(staffAvatarAltText(null, 'a@b.c')).toBe('Аватар: a@b.c');
  });

  it('дефолт без имени и email', () => {
    expect(staffAvatarAltText(null, null)).toBe('Аватар сотрудника');
  });
});
