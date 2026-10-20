import type { AdminUser, AdminUserList, AlertRule, AuthUser, Channel } from '@alert-app/shared';
import type { Session } from '../global/utils/authApi';

/** Test data for a logged-in user. Override fields as needed. */
export function testUser(changes: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: false,
    username: 'test.user',
    displayUsername: 'Test.User',
    role: 'user',
    image: null,
    createdAt: new Date('2026-10-19T10:00:00Z'),
    updatedAt: new Date('2026-10-19T10:00:00Z'),
    ...changes,
  };
}

export function testSession(changes: Partial<AuthUser> = {}): Session {
  return { user: testUser(changes) };
}

export const adminSession = () =>
  testSession({ id: 'admin-1', name: 'Admin', username: 'admin.user', role: 'admin' });

/** A user as the admin users page gets it from GET /api/admin/users. */
export function testAdminUser(changes: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    name: 'Bob Builder',
    username: 'Bob.Builder',
    email: 'bob@example.com',
    role: 'user',
    disabled: false,
    createdAt: '2026-10-19T10:00:00.000Z',
    ...changes,
  };
}

/** One page of the admin users list. `total` defaults to the number of items. */
export function testAdminUserList(
  items: AdminUser[],
  changes: Partial<AdminUserList> = {},
): AdminUserList {
  return { items, total: items.length, page: 1, pageSize: 20, ...changes };
}

/** An alert rule as GET /api/alert-rules returns it. Defaults to a keyword rule. */
export function testAlertRule(changes: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-1',
    name: 'EV news',
    type: 'keywords',
    keywords: ['electric car', 'Tesla'],
    category: null,
    enabled: true,
    channelIds: ['channel-1'],
    lastAlertAt: null,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    ...changes,
  };
}

/** A channel as GET /api/channels returns it. Defaults to the email channel of testUser(). */
export function testChannel(changes: Partial<Channel> = {}): Channel {
  return { id: 'channel-1', type: 'email', destination: 'test@example.com', ...changes };
}
