import { isAllowedAdminBackendPath } from '@vspomni/admin-sections';

describe('admin backend allowlist', () => {
  it('allows catalog admin', () => {
    expect(isAllowedAdminBackendPath(['catalog', 'admin', 'products'])).toBe(true);
  });
  it('rejects assistant and quiz', () => {
    expect(isAllowedAdminBackendPath(['assistant', 'admin', 'chat'])).toBe(false);
    expect(isAllowedAdminBackendPath(['quiz', 'admin', 'x'])).toBe(false);
  });
});
