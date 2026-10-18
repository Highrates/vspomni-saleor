import { describe, expect, it } from 'vitest';
import {
  isAllowedAdminBackendPath,
  resolveAdminSectionFromApiPath,
  resolveAdminSectionFromPathname,
  staffCanAccessAdminPath,
  staffCanSeeOrdersNav,
} from './index';

describe('admin-sections ACL', () => {
  it('allows catalog admin BFF', () => {
    expect(isAllowedAdminBackendPath(['catalog', 'admin', 'products'])).toBe(true);
  });

  it('rejects assistant and quiz BFF', () => {
    expect(isAllowedAdminBackendPath(['assistant', 'admin', 'chat'])).toBe(false);
    expect(isAllowedAdminBackendPath(['quiz', 'admin', 'x'])).toBe(false);
    expect(isAllowedAdminBackendPath(['user-groups', 'admin'])).toBe(false);
  });

  it('maps API paths', () => {
    expect(resolveAdminSectionFromApiPath('/api/v1/catalog/admin/products')).toBe('catalog');
    expect(resolveAdminSectionFromApiPath('/api/v1/orders/admin/1/mark-paid')).toBe(
      'orders_finance',
    );
  });

  it('maps pathnames', () => {
    expect(resolveAdminSectionFromPathname('/admin')).toBe('dashboard');
    expect(resolveAdminSectionFromPathname('/admin/catalog/tags')).toBe('catalog');
    expect(resolveAdminSectionFromPathname('/admin/quiz')).toBe(null);
  });

  it('staff path access', () => {
    expect(staffCanAccessAdminPath('/admin', [], false)).toBe(true);
    expect(staffCanAccessAdminPath('/admin/settings', [], false)).toBe(false);
    expect(staffCanSeeOrdersNav(['orders'], false)).toBe(true);
  });
});
