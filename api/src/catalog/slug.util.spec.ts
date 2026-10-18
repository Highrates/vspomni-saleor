import { describe, expect, it } from 'vitest';
import { slugify, volumeSlugPart } from './slug.util';

describe('slugify', () => {
  it('транслитерирует кириллицу', () => {
    expect(slugify('Крем увлажняющий')).toBe('krem-uvlazhnyayuschiy');
  });

  it('схлопывает пробелы и пунктуацию', () => {
    expect(slugify('  Face / Body  ')).toBe('face-body');
  });

  it('fallback для пустой строки', () => {
    expect(slugify('   ')).toBe('item');
    expect(slugify('!!!')).toBe('item');
  });
});

describe('volumeSlugPart', () => {
  it('убирает пробелы в объёме', () => {
    expect(volumeSlugPart('50 ml')).toBe('50ml');
    expect(volumeSlugPart('100 мл')).toBe('100ml');
  });

  it('принимает число мл', () => {
    expect(volumeSlugPart(50)).toBe('50');
  });
});
