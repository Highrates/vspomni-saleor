import { describe, expect, it } from 'vitest';
import { safeAdminReturnPath, safeReturnPath } from './safeReturnPath';

describe('safeReturnPath', () => {
  it('allows relative paths', () => {
    expect(safeReturnPath('/checkout')).toBe('/checkout');
    expect(safeReturnPath('/catalog?tag=x')).toBe('/catalog?tag=x');
  });

  it('blocks protocol-relative and schemes', () => {
    expect(safeReturnPath('//evil.com')).toBe('/');
    expect(safeReturnPath('/%2F%2Fevil.com')).toBe('/');
    expect(safeReturnPath('/\\evil.com')).toBe('/');
  });

  it('blocks auth/admin loops', () => {
    expect(safeReturnPath('/login')).toBe('/');
    expect(safeReturnPath('/login/forgot-password')).toBe('/');
    expect(safeReturnPath('/register')).toBe('/');
    expect(safeReturnPath('/admin')).toBe('/');
  });
});

describe('safeAdminReturnPath', () => {
  it('allows admin paths except login', () => {
    expect(safeAdminReturnPath('/admin/catalog')).toBe('/admin/catalog');
    expect(safeAdminReturnPath('/admin/login')).toBe('/admin');
    expect(safeAdminReturnPath('/checkout')).toBe('/admin');
    expect(safeAdminReturnPath('//evil.com')).toBe('/admin');
  });
});
