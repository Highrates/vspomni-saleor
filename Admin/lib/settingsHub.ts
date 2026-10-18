import {
  staffCanAccessAdminPath,
  type AdminSectionId,
} from '@vspomni/admin-sections';
import type { StaffContext } from '@/lib/adminStaffTypes';

export type SettingsHubLink = {
  href: string;
  label: string;
  section: AdminSectionId | 'staff';
  /** Hub badge: grant для доступа, если ≠ settings. */
  aclBadge?: string;
};

/** Карточки hub `/admin/settings` — hub только суперадмин. */
export const SETTINGS_HUB_LINKS: readonly SettingsHubLink[] = [
  { href: '/admin/settings/seo', label: 'SEO', section: 'settings' },
  {
    href: '/admin/settings/email-notifications',
    label: 'Email-уведомления',
    section: 'settings',
  },
  { href: '/admin/settings/menu', label: 'Меню', section: 'settings' },
  { href: '/admin/settings/attributes', label: 'Атрибуты', section: 'settings' },
  { href: '/admin/settings/delivery', label: 'Службы доставки', section: 'staff' },
  { href: '/admin/settings/staff', label: 'Сотрудники', section: 'staff' },
];

export function filterSettingsHubLinks(staff: StaffContext): SettingsHubLink[] {
  return SETTINGS_HUB_LINKS.filter((link) =>
    staffCanAccessAdminPath(
      link.href,
      staff.sections as AdminSectionId[],
      staff.isSuperAdmin,
    ),
  );
}
