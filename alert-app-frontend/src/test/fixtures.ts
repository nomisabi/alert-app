import type { AuthUser } from '@alert-app/shared';
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
