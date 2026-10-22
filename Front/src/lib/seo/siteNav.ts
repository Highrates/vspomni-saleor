/**
 * Явная навигация по разделам каталога — шапка/футер.
 * Короткие стабильные якоря помогают Google строить sitelinks.
 */
export type SiteNavLink = {
  href: string
  label: string
}

/** Основные категории витрины (slug Nest). */
export const SITE_CATEGORY_NAV: readonly SiteNavLink[] = [
  { href: '/category/diffuzory', label: 'Диффузоры' },
  { href: '/category/aromasashe', label: 'Саше' },
  {
    href: '/category/iarkaia-i-stilnaia-upakovka',
    label: 'Парфюм для дома',
  },
  { href: '/category/podarochnye-pakety', label: 'Подарки' },
] as const

/** Полный первичный ряд: каталог + категории + все ароматы. */
export const SITE_PRIMARY_NAV: readonly SiteNavLink[] = [
  { href: '/catalog', label: 'Каталог' },
  ...SITE_CATEGORY_NAV,
  { href: '/#vse-aromaty', label: 'Все ароматы' },
] as const
