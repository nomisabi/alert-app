/** Where Better Auth's endpoints live, e.g. /api/auth/sign-in/email. */
export const AUTH_BASE_PATH = '/api/auth';

export const ROLES = ['user', 'admin'] as const;

export const DISPLAY_NAME_MAX_LENGTH = 50;
export const USERNAME_MIN_LENGTH = 6;
export const USERNAME_MAX_LENGTH = 30;
/** Same characters as Better Auth's username plugin allows by default. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
