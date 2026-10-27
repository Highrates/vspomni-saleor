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
    expect(
      resolveAdminSectionFromApiPath('/api/v1/catalog/admin/upload-rich-media?type=image'),
    ).toBe('media_upload');
    expect(resolveAdminSectionFromApiPath('/api/v1/orders/admin/1/mark-paid')).toBe(
      'orders_finance',
    );
  });

  it('maps pathnames', () => {
    expect(resolveAdminSectionFromPathname('/admin')).toBe('dashboard');
    expect(resolveAdminSectionFromPathname('/admin/catalog/tags')).toBe('catalog');
    expect(
      resolveAdminSectionFromPathname('/admin/catalog/aroma-note-definitions'),
    ).toBe('catalog');
    expect(resolveAdminSectionFromPathname('/admin/unpacking')).toBe('settings');
    expect(resolveAdminSectionFromPathname('/admin/quiz')).toBe(null);
  });

  it('unpacking settings API + media_upload for video', () => {
    expect(
      resolveAdminSectionFromApiPath('/api/v1/settings/admin/unpacking'),
    ).toBe('settings');
    expect(
      resolveAdminSectionFromApiPath(
        '/api/v1/catalog/admin/upload-rich-media?type=video',
      ),
    ).toBe('media_upload');
    expect(
      staffCanAccessAdminPath('/admin/unpacking', ['settings'], false),
    ).toBe(true);
    expect(staffCanAccessAdminPath('/admin/unpacking', ['orders'], false)).toBe(
      false,
    );
  });

  it('staff path access', () => {
    expect(staffCanAccessAdminPath('/admin', [], false)).toBe(true);
    expect(staffCanAccessAdminPath('/admin/settings', [], false)).toBe(false);
    expect(staffCanSeeOrdersNav(['orders'], false)).toBe(true);
  });
});
