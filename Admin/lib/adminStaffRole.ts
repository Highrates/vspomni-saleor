/** Проверка роли для admin BFF cookie (без Nest). */
export function isAdminStaffRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'MODERATOR';
}
