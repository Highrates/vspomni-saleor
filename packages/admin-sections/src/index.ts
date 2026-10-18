/**
 * Единый источник ACL админки Vspomni (pathname + API path).
 */

export const ADMIN_SECTION_DASHBOARD = 'dashboard' as const;

export const ADMIN_SECTION_IDS = [
  ADMIN_SECTION_DASHBOARD,
  'catalog',
  'users',
  'blog',
  'discounts',
  'certificates',
  /** issue / adjust / revoke / extend / resend — отдельно от номиналов и списка. */
  'certificates_finance',
  'orders',
  /** mark-paid / refund — отдельно от просмотра и фулфилмента заказов. */
  'orders_finance',
  'settings',
] as const;

export type AdminSectionId = (typeof ADMIN_SECTION_IDS)[number];

/** Разделы, которые можно назначить MODERATOR (дашборд — всегда). */
export const MODERATOR_ASSIGNABLE_SECTIONS = ADMIN_SECTION_IDS.filter(
  (id) => id !== ADMIN_SECTION_DASHBOARD,
) as Exclude<AdminSectionId, typeof ADMIN_SECTION_DASHBOARD>[];

export type ModeratorAssignableSectionId = (typeof MODERATOR_ASSIGNABLE_SECTIONS)[number];

export const ALL_STAFF_SECTIONS_WITH_DASHBOARD: readonly AdminSectionId[] = [
  ...ADMIN_SECTION_IDS,
];

export function isAdminSectionId(value: string): value is AdminSectionId {
  return (ADMIN_SECTION_IDS as readonly string[]).includes(value);
}

export function normalizeStoredAdminSections(
  raw: readonly string[],
): ModeratorAssignableSectionId[] {
  const seen = new Set<ModeratorAssignableSectionId>();
  for (const item of raw) {
    if (
      isAdminSectionId(item) &&
      item !== ADMIN_SECTION_DASHBOARD &&
      (MODERATOR_ASSIGNABLE_SECTIONS as readonly string[]).includes(item)
    ) {
      seen.add(item as ModeratorAssignableSectionId);
    }
  }
  return MODERATOR_ASSIGNABLE_SECTIONS.filter((id) => seen.has(id));
}

export const ADMIN_SECTION_LABELS_RU: Record<AdminSectionId, string> = {
  dashboard: 'Дашборд',
  catalog: 'Каталог',
  users: 'Пользователи',
  blog: 'Блог',
  discounts: 'Скидки и промо',
  certificates: 'Сертификаты: номиналы и список',
  certificates_finance: 'Сертификаты: выпуск и операции',
  orders: 'Заказы',
  orders_finance: 'Заказы: оплата и возвраты',
  settings: 'Настройки',
};

export type AdminApiAccessTarget = AdminSectionId | 'staff' | 'certificates_read';

export const ADMIN_BACKEND_BFF_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['catalog', 'admin'],
  ['users', 'admin'],
  ['newsletter', 'admin'],
  ['dashboard', 'admin'],
  ['discounts', 'admin'],
  ['promo', 'admin'],
  ['orders', 'admin'],
  ['blog', 'admin'],
  ['cms', 'admin'],
  ['gift-certificates', 'admin'],
  ['settings', 'admin'],
  ['auth', 'admin'],
  ['delivery', 'ozon'],
] as const;

export function adminApiPathToBffPrefix(pathOnly: string): [string, string] | null {
  const p = pathOnly.split('?')[0].replace(/\/+$/, '');
  const rest = p.replace(/^\/api\/v1\/?/, '').replace(/^\//, '');
  const parts = rest.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0], parts[1]];
}

export function isAllowedAdminBackendPath(segments: string[]): boolean {
  if (segments.length < 2) return false;
  const [a, b] = segments;
  return ADMIN_BACKEND_BFF_PREFIXES.some(([prefix, second]) => prefix === a && second === b);
}

export function resolveAdminSectionFromApiPath(
  pathOnly: string,
  method?: string,
): AdminApiAccessTarget | null {
  const p = pathOnly.split('?')[0].replace(/\/+$/, '');
  const m = (method ?? 'GET').toUpperCase();

  if (p.includes('/settings/admin/staff-profile')) return 'dashboard';
  if (p.includes('/settings/admin/staff')) return 'staff';
  if (p.includes('/delivery/ozon/admin')) return 'staff';

  if (p.includes('/users/admin')) return 'users';
  if (p.includes('/newsletter/admin')) return 'users';
  if (
    p.includes('/orders/admin/') &&
    (p.endsWith('/mark-paid') || p.endsWith('/refund'))
  ) {
    return 'orders_finance';
  }
  if (p.includes('/orders/admin')) return 'orders';
  if (p.includes('/blog/admin')) return 'blog';
  if (p.includes('/cms/admin')) return 'blog';
  if (p.includes('/discounts/admin')) return 'discounts';
  if (p.includes('/promo/admin')) return 'discounts';
  if (p.includes('/gift-certificates/admin')) {
    if (
      /\/gift-certificates\/admin\/issue\/?$/.test(p) ||
      /\/gift-certificates\/admin\/[^/]+\/(revoke|adjust|extend|resend-email)\/?$/.test(p)
    ) {
      return 'certificates_finance';
    }
    if (
      p.includes('/gift-certificates/admin/denominations') ||
      p.includes('/gift-certificates/admin/denomination-images')
    ) {
      return m === 'GET' ? 'certificates_read' : 'certificates';
    }
    return 'certificates_read';
  }
  if (p.includes('/dashboard/admin')) return 'dashboard';
  if (p.includes('/settings/admin/')) return 'settings';
  if (p.includes('/catalog/admin')) return 'catalog';
  if (p.includes('/auth/admin/me') || p.endsWith('/auth/me')) return 'dashboard';

  return null;
}

export type AdminPathAccessTarget = AdminSectionId | 'staff';

export function resolveAdminSectionFromPathname(pathname: string): AdminPathAccessTarget | null {
  const p = pathname.replace(/\/+$/, '') || '/';

  if (p === '/admin/login') return null;
  if (p === '/admin/settings/staff/me') return ADMIN_SECTION_DASHBOARD;
  if (p === '/admin') return ADMIN_SECTION_DASHBOARD;

  if (p === '/admin/settings/staff' || p.startsWith('/admin/settings/staff/')) {
    return 'staff';
  }
  if (p === '/admin/settings/delivery' || p.startsWith('/admin/settings/delivery/')) {
    return 'staff';
  }

  if (p.startsWith('/admin/faq')) return 'settings';
  if (
    p.startsWith('/admin/hero') ||
    p.startsWith('/admin/stories') ||
    p.startsWith('/admin/homepage-sets') ||
    p.startsWith('/admin/settings/hero') ||
    p.startsWith('/admin/settings/home')
  ) {
    return 'settings';
  }
  if (p === '/admin/settings') return 'staff';
  if (p.startsWith('/admin/settings/')) return 'settings';
  if (
    p.startsWith('/admin/catalog') ||
    p.startsWith('/admin/collections') ||
    p.startsWith('/admin/product-sets') ||
    p.startsWith('/admin/products')
  ) {
    return 'catalog';
  }
  if (p.startsWith('/admin/users')) return 'users';
  if (p.startsWith('/admin/blog') || p.startsWith('/admin/pages')) return 'blog';
  if (p.startsWith('/admin/discounts') || p.startsWith('/admin/promo')) return 'discounts';
  if (p.startsWith('/admin/certificates')) return 'certificates';
  if (p.startsWith('/admin/orders')) return 'orders';

  return null;
}

export function staffCanAccessAdminPath(
  pathname: string,
  sections: readonly AdminSectionId[],
  isSuperAdmin: boolean,
): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/admin/login') return true;
  if (isSuperAdmin) return true;

  const target = resolveAdminSectionFromPathname(pathname);
  if (target == null) return false;
  if (target === 'staff') return false;
  if (target === ADMIN_SECTION_DASHBOARD) return true;
  if (target === 'orders') {
    return staffCanAccessOrdersUi(sections, isSuperAdmin);
  }
  if (target === 'certificates') {
    return staffCanAccessCertificatesUi(sections, isSuperAdmin);
  }
  return sections.includes(target);
}

export function staffCanAccessOrdersUi(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  return sections.includes('orders') || sections.includes('orders_finance');
}

export function staffCanAccessCertificatesUi(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  return sections.includes('certificates') || sections.includes('certificates_finance');
}

export function staffCanSeeOrdersNav(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  return staffCanAccessOrdersUi(sections, isSuperAdmin);
}

export function staffCanSeeCertificatesNav(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  return staffCanAccessCertificatesUi(sections, isSuperAdmin);
}

export function staffCanOrdersFinance(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  return sections.includes('orders_finance');
}

export function staffCanCertificatesFinance(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  return sections.includes('certificates_finance');
}

export function staffCanCertificatesCatalog(
  sections: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  return sections.includes('certificates');
}

export const SECTIONS_NEEDING_CATALOG: readonly ModeratorAssignableSectionId[] = [
  'discounts',
  'certificates',
  'certificates_finance',
];

export function sectionsMissingCatalogHint(
  sections: readonly string[],
): ModeratorAssignableSectionId[] {
  const set = new Set(sections);
  if (set.has('catalog')) return [];
  return SECTIONS_NEEDING_CATALOG.filter((id) => set.has(id));
}

export const SECTIONS_NEEDING_FULFILLMENT: readonly ModeratorAssignableSectionId[] = [
  'orders_finance',
];

/** @deprecated используйте SECTIONS_NEEDING_FULFILLMENT */
export const SECTIONS_NEEDING_ORDERS = SECTIONS_NEEDING_FULFILLMENT;

export function sectionsMissingFulfillmentHint(
  sections: readonly string[],
): ModeratorAssignableSectionId[] {
  const set = new Set(sections);
  if (set.has('orders')) return [];
  return SECTIONS_NEEDING_FULFILLMENT.filter((id) => set.has(id));
}

/** @deprecated используйте sectionsMissingFulfillmentHint */
export function sectionsMissingOrdersHint(
  sections: readonly string[],
): ModeratorAssignableSectionId[] {
  return sectionsMissingFulfillmentHint(sections);
}

export const SECTIONS_NEEDING_CERTIFICATES_CATALOG: readonly ModeratorAssignableSectionId[] = [
  'certificates_finance',
];

export function sectionsMissingCertificatesCatalogHint(
  sections: readonly string[],
): ModeratorAssignableSectionId[] {
  const set = new Set(sections);
  if (set.has('certificates')) return [];
  return SECTIONS_NEEDING_CERTIFICATES_CATALOG.filter((id) => set.has(id));
}
