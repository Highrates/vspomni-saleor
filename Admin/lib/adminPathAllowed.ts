import type { StaffContext } from '@/lib/adminStaffTypes';
import { staffCanAccessAdminPath, type AdminSectionId } from '@/lib/adminSections';

/** Path-guard для server layout (не импортировать из client AdminChrome). */
export function adminPathAllowed(
  pathname: string,
  staff: StaffContext | null | undefined,
): boolean {
  if (!staff) return false;
  return staffCanAccessAdminPath(
    pathname,
    staff.sections as AdminSectionId[],
    staff.isSuperAdmin,
  );
}
