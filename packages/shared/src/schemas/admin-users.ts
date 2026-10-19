import { z } from 'zod';
import { USER_SEARCH_MAX_LENGTH } from '../constants/admin-users.js';
import { roleSchema } from './auth.js';
import { paginatedSchema, paginationQuerySchema } from './pagination.js';

/** Query of GET /api/admin/users. */
export const adminUserListQuerySchema = paginationQuerySchema.extend({
  /** Matches username or email (case-insensitive, "contains"). Empty = all users. */
  search: z.string().trim().max(USER_SEARCH_MAX_LENGTH, 'search.tooLong').optional(),
});
export type AdminUserListQuery = z.input<typeof adminUserListQuerySchema>;

/** One user, as the admin users page sees it. */
export const adminUserSchema = z.object({
  id: z.string(),
  /** Display name. */
  name: z.string(),
  /** Spelled as the user typed it (Better Auth's `displayUsername`). */
  username: z.string(),
  email: z.string(),
  role: roleSchema,
  /** Disabled users are logged out and can't log in (Better Auth's admin plugin calls this "banned"). */
  disabled: z.boolean(),
  /** ISO 8601, e.g. 2026-10-19T20:46:42.000Z */
  createdAt: z.iso.datetime(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** Response of GET /api/admin/users. Newest users first. */
export const adminUserListSchema = paginatedSchema(adminUserSchema);
export type AdminUserList = z.infer<typeof adminUserListSchema>;

/**
 * Body of PATCH /api/admin/users/:id. Only the fields that are sent change.
 * An admin can't change their own role or disable themselves (checked in the backend).
 */
export const updateAdminUserRequestSchema = z.object({
  role: roleSchema.optional(),
  disabled: z.boolean().optional(),
});
export type UpdateAdminUserRequest = z.infer<typeof updateAdminUserRequestSchema>;
