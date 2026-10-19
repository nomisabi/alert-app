import { AUTH_BASE_PATH, type AuthUser, type SignUpRequest } from '@alert-app/shared';
import { apiFetch } from './apiFetch';

// The auth endpoints (Better Auth, behind our backend). Contract: docs/PROJECT_PLAN.md, milestone 1.

export interface Session {
  user: AuthUser;
}

/** The current session, or null when logged out. */
export function getSession() {
  return apiFetch<Session | null>(`${AUTH_BASE_PATH}/get-session`);
}

export function signUp(body: SignUpRequest) {
  return apiFetch<{ user: AuthUser }>(`${AUTH_BASE_PATH}/sign-up/email`, {
    method: 'POST',
    json: body,
  });
}

export function signIn(body: { email: string; password: string }) {
  return apiFetch<{ user: AuthUser }>(`${AUTH_BASE_PATH}/sign-in/email`, {
    method: 'POST',
    json: body,
  });
}

export function signOut() {
  return apiFetch<{ success: boolean }>(`${AUTH_BASE_PATH}/sign-out`, { method: 'POST', json: {} });
}

export function isUsernameAvailable(username: string) {
  return apiFetch<{ available: boolean }>(`${AUTH_BASE_PATH}/is-username-available`, {
    method: 'POST',
    json: { username },
  });
}
