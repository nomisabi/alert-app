import {
  AUTH_BASE_PATH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@alert-app/shared';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, username } from 'better-auth/plugins';
import type { PrismaClient } from '../generated/prisma/client.js';

interface CreateAuthOptions {
  prisma: PrismaClient;
  secret: string;
  /** The backend's own URL. */
  baseURL: string;
  /** Frontend URLs allowed to call the auth endpoints (checked against the Origin header). */
  trustedOrigins: string[];
}

/**
 * The Better Auth configuration. A plain function (not a Nest provider), so the seed script
 * can create the same instance outside of Nest.
 * Docs: https://better-auth.com/docs/reference/options
 */
export function createAuth({ prisma, secret, baseURL, trustedOrigins }: CreateAuthOptions) {
  return betterAuth({
    appName: 'Alert App',
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret,
    trustedOrigins,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      // Same limits as the shared Zod schemas
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    plugins: [
      username({ minUsernameLength: USERNAME_MIN_LENGTH, maxUsernameLength: USERNAME_MAX_LENGTH }),
      // Adds `role` (can't be set through sign-up, so nobody can make themselves admin) and
      // `banned` (= disabled). Blocks login for banned users with the code BANNED_USER.
      // Its own /admin/* endpoints are not reachable (see AuthController): we have our own.
      admin({ defaultRole: 'user', adminRoles: ['admin'] }),
    ],
    // Login is by email only
    disabledPaths: ['/sign-in/username'],
    telemetry: { enabled: false },
    advanced: {
      // Better Auth turns its origin check (CSRF protection) off when NODE_ENV=test.
      // Keep it on, so the e2e tests check the same protection as production.
      disableOriginCheck: false,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
