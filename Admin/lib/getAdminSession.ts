import { cookies } from 'next/headers';
import { ADMIN_ACCESS_TOKEN_COOKIE } from './adminAuth';
import { getServerApiBase } from './serverApiBase';
import { ALL_STAFF_SECTIONS_WITH_DASHBOARD } from './adminSections';
import type { AdminSectionId } from './adminSections';
import type { StaffContext } from './adminStaffTypes';

export type AdminSessionUser = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
};

export type AdminSession =
  | {
      authenticated: true;
      user: AdminSessionUser;
      staff: StaffContext | null;
    }
  | { authenticated: false; error?: 'api_unreachable' | 'unauthorized' };

export async function getAdminSession(): Promise<AdminSession> {
  const token = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value?.trim();
  if (!token) return { authenticated: false };

  let res: Response;
  try {
    res = await fetch(`${getServerApiBase()}/auth/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return { authenticated: false, error: 'api_unreachable' };
  }

  if (!res.ok) return { authenticated: false, error: 'unauthorized' };

  const data = (await res.json()) as AdminSessionUser & {
    staff?: StaffContext | null;
    role: string;
  };

  if (!data?.id || (data.role !== 'ADMIN' && data.role !== 'MODERATOR')) {
    return { authenticated: false, error: 'unauthorized' };
  }

  const staff: StaffContext | null = data.staff
    ? {
        isSuperAdmin: Boolean(data.staff.isSuperAdmin),
        sections: (data.staff.sections ?? []) as AdminSectionId[],
        staffDisplayName: data.staff.staffDisplayName ?? null,
        staffAvatarUrl: data.staff.staffAvatarUrl ?? null,
      }
    : data.role === 'ADMIN'
      ? {
          isSuperAdmin: true,
          sections: [...ALL_STAFF_SECTIONS_WITH_DASHBOARD],
          staffDisplayName: null,
          staffAvatarUrl: null,
        }
      : null;

  return {
    authenticated: true,
    user: {
      id: data.id,
      email: data.email,
      role: data.role,
      displayName: data.displayName ?? null,
    },
    staff,
  };
}
