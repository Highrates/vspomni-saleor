import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  normalizeStoredUploadUrl,
  parseOptionalDateOnly,
} from './catalog-admin.helpers';

describe('parseOptionalDateOnly', () => {
  it('undefined → undefined (поле не трогаем)', () => {
    expect(parseOptionalDateOnly(undefined)).toBeUndefined();
  });

  it('null / пустая строка → null (очистить)', () => {
    expect(parseOptionalDateOnly(null)).toBeNull();
    expect(parseOptionalDateOnly('')).toBeNull();
    expect(parseOptionalDateOnly('   ')).toBeNull();
  });

  it('YYYY-MM-DD → UTC noon того же календарного дня', () => {
    const d = parseOptionalDateOnly('2026-03-15');
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe('2026-03-15T12:00:00.000Z');
  });

  it('ISO с временем: берёт Y-M-D префикс', () => {
    const d = parseOptionalDateOnly('2026-03-15T00:00:00.000Z');
    expect(d!.toISOString()).toBe('2026-03-15T12:00:00.000Z');
  });

  it('невалидная дата → BadRequestException', () => {
    expect(() => parseOptionalDateOnly('2026-13-40')).toThrow(BadRequestException);
    expect(() => parseOptionalDateOnly('not-a-date')).toThrow(BadRequestException);
  });
});

describe('normalizeStoredUploadUrl', () => {
  it('null / пусто → null', () => {
    expect(normalizeStoredUploadUrl(null)).toBeNull();
  });

  it('absolute Nest URL → /uploads/…', () => {
    expect(
      normalizeStoredUploadUrl(
        'http://127.0.0.1:3011/uploads/products/x/photo.jpg',
      ),
    ).toBe('/uploads/products/x/photo.jpg');
  });

  it('уже relative — без изменений', () => {
    expect(normalizeStoredUploadUrl('/uploads/a.jpg')).toBe('/uploads/a.jpg');
  });
});
