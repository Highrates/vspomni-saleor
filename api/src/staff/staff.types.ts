import {
  normalizeStoredAdminSections,
  type ModeratorAssignableSectionId,
} from '@vspomni/admin-sections';
import type {
  CreateStaffResponse,
  ResetStaffPasswordResponse,
  StaffAdminRow,
  StaffContext,
  StaffRole,
} from '@vspomni/admin-types';
import { UserRole } from '@prisma/client';

export type {
  CreateStaffResponse,
  ResetStaffPasswordResponse,
  StaffAdminRow,
  StaffContext,
  StaffRole,
} from '@vspomni/admin-types';

export const STAFF_DELETED_EMAIL_PREFIX = 'staff-deleted-';

export function staffDeletedEmail(userId: string): string {
  return `${STAFF_DELETED_EMAIL_PREFIX}${userId}@invalid.local`;
}

export type StaffAccessSnapshot = {
  role: UserRole;
  isActive: boolean;
  staffDeletedAt: Date | null;
  adminSections: string[];
  staffDisplayName: string | null;
  staffAvatarUrl: string | null;
  tokenVersion: number;
};

function toStaffRole(role: UserRole): StaffRole {
  return role === UserRole.ADMIN ? 'ADMIN' : 'MODERATOR';
}

export function rowFromUser(u: {
  id: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  staffDisplayName: string | null;
  staffAvatarUrl: string | null;
  adminSections: string[];
  lastAdminLoginAt: Date | null;
  createdAt: Date;
}): StaffAdminRow {
  return {
    id: u.id,
    email: u.email,
    role: toStaffRole(u.role),
    isActive: u.isActive,
    staffDisplayName: u.staffDisplayName,
    staffAvatarUrl: u.staffAvatarUrl,
    adminSections: normalizeStoredAdminSections(u.adminSections),
    lastAdminLoginAt: u.lastAdminLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

export const staffUserSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  staffDisplayName: true,
  staffAvatarUrl: true,
  adminSections: true,
  lastAdminLoginAt: true,
  createdAt: true,
  staffDeletedAt: true,
} as const;
