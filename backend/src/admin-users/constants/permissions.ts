import { AdminRole, ADMIN_ROLE_PERMISSIONS } from '../../database/entities/admin-user.entity';

/** All known permission strings (for validation). */
export const ALL_PERMISSIONS: string[] = [
  'merchants:read',
  'merchants:write',
  'merchants:kyc:review',
  'analytics:read',
  'analytics:revenue',
  'config:read',
  'config:write',
  'admin:queues',
  'admin-users:manage',
];

export function getEffectivePermissions(
  role: AdminRole,
  customPermissions: string[],
  revokedPermissions: string[],
): string[] {
  const base = ADMIN_ROLE_PERMISSIONS[role] ?? [];
  const withCustom = [...new Set([...base, ...customPermissions])];
  return withCustom.filter((p) => !revokedPermissions.includes(p));
}
