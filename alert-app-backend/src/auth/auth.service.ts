import type { AuthUser } from '@alert-app/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createAuth, type Auth } from './create-auth.js';

/** Holds the Better Auth instance. Inject it to read the current user (see AuthGuard). */
@Injectable()
export class AuthService {
  readonly auth: Auth;

  constructor(prisma: PrismaService, config: ConfigService<Env, true>) {
    this.auth = createAuth({
      prisma,
      secret: config.get('BETTER_AUTH_SECRET', { infer: true }),
      baseURL: config.get('BETTER_AUTH_URL', { infer: true }),
      trustedOrigins: [config.get('CORS_ORIGIN', { infer: true })],
    });
  }

  /** The logged-in user for the session cookie in these headers, or null. */
  async getUser(headers: IncomingHttpHeaders): Promise<AuthUser | null> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) });
    return (session?.user as AuthUser | undefined) ?? null;
  }
}
