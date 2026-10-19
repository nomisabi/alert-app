import type {
  AdminUser,
  AdminUserList,
  adminUserListQuerySchema,
  UpdateAdminUserRequest,
} from '@alert-app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { ApiException } from '../errors/api.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The user columns the admin page needs (never the password hash or sessions). */
const adminUserSelect = {
  id: true,
  name: true,
  displayUsername: true,
  email: true,
  role: true,
  banned: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

/** User management for admins. The rules live here, the controller only handles HTTP. */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** One page of users, newest first. `search` matches username or email ("contains", any case). */
  async list({
    search,
    page,
    pageSize,
  }: z.output<typeof adminUserListQuerySchema>): Promise<AdminUserList> {
    const text = search && escapeLike(search);
    const where: Prisma.UserWhereInput = text
      ? {
          OR: [
            { username: { contains: text, mode: 'insensitive' } },
            { email: { contains: text, mode: 'insensitive' } },
          ],
        }
      : {};

    // Both queries in one transaction, so `total` matches the rows (no sign-up in between)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: adminUserSelect,
        // `id` as a tie-breaker: users created in the same millisecond keep a stable order between pages
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: rows.map(toAdminUser), total, page, pageSize };
  }

  /**
   * Changes the role and/or disabled state. Only the fields in `changes` are touched.
   * Disabling also deletes the user's sessions, so they are logged out at once
   * (Better Auth's admin plugin then blocks new logins because `banned` is true).
   */
  async update(
    currentUserId: string,
    userId: string,
    changes: UpdateAdminUserRequest,
  ): Promise<AdminUser> {
    // Admins can't lock themselves out. The caller is an admin (AdminGuard), so "admin" is no change.
    if (userId === currentUserId) {
      if (changes.role !== undefined && changes.role !== 'admin') {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'CANNOT_CHANGE_OWN_ROLE');
      }
      if (changes.disabled === true) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'CANNOT_DISABLE_SELF');
      }
    }

    // One transaction: the role, the disabled flag and the logout are saved together or not at all
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.user.count({ where: { id: userId } });
      if (!exists) throw new ApiException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          role: changes.role,
          banned: changes.disabled,
          // Enabling clears what the plugin may have stored about the ban
          ...(changes.disabled === false && { banReason: null, banExpires: null }),
        },
        select: adminUserSelect,
      });

      if (changes.disabled === true) {
        await tx.session.deleteMany({ where: { userId } });
      }

      return toAdminUser(user);
    });
  }
}

/**
 * Prisma's `contains` becomes SQL `ILIKE '%text%'`, where `_` means "any character" and `%` means
 * "any text". Prisma doesn't escape them, so searching "a_b" would also find "axb".
 * The backslash makes them normal characters again.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/** Database row → API shape. The API says "disabled", the database (Better Auth) says "banned". */
function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    username: row.displayUsername,
    email: row.email,
    role: row.role,
    disabled: row.banned,
    createdAt: row.createdAt.toISOString(),
  };
}
