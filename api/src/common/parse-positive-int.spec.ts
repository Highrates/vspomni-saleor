import { describe, expect, it } from 'vitest';
import { parseOptionalPositiveInt } from './parse-positive-int';

describe('parseOptionalPositiveInt', () => {
  it('парсит целые ≥ 1', () => {
    expect(parseOptionalPositiveInt('1')).toBe(1);
    expect(parseOptionalPositiveInt('20')).toBe(20);
  });

  it('отсекает NaN / дробные / ≤0 / пустое', () => {
    expect(parseOptionalPositiveInt(undefined)).toBeUndefined();
    expect(parseOptionalPositiveInt('')).toBeUndefined();
    expect(parseOptionalPositiveInt('abc')).toBeUndefined();
    expect(parseOptionalPositiveInt('1.5')).toBeUndefined();
    expect(parseOptionalPositiveInt('0')).toBeUndefined();
    expect(parseOptionalPositiveInt('-2')).toBeUndefined();
  });
});
