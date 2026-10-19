import {
  AUTH_BASE_PATH,
  loginSchema,
  signUpRequestSchema,
  usernameSchema,
} from '@alert-app/shared';
import { All, Controller, HttpStatus, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { ApiException, parseBody } from '../errors/api.exception.js';
import { AuthService } from './auth.service.js';

/** Request bodies we validate with the shared schemas before Better Auth sees them. */
const bodySchemas: Record<string, z.ZodType> = {
  '/sign-up/email': signUpRequestSchema,
  '/sign-in/email': loginSchema,
  '/is-username-available': z.object({ username: usernameSchema }),
};

/** Better Auth error codes that belong to one form field. */
const fieldForErrorCode: Record<string, string> = {
  USERNAME_IS_ALREADY_TAKEN: 'username',
  USER_ALREADY_EXISTS: 'email',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'email',
};

/**
 * Passes every /api/auth/* request to Better Auth. Going through a Nest controller (instead of
 * mounting Better Auth directly on Express) lets us:
 * - validate the body with the same Zod schemas as the frontend (and drop unknown fields like `role`)
 * - turn Better Auth's errors into our error format (ApiExceptionFilter translates them)
 */
@ApiExcludeController()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Express 5 syntax: `*path` matches everything below /auth/
  @All('*path')
  async handle(@Req() req: Request, @Res() res: Response) {
    const authPath = req.path.slice(AUTH_BASE_PATH.length);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const schema = bodySchemas[authPath];
    const body: unknown = hasBody && schema ? parseBody(schema, req.body) : req.body;

    const headers = fromNodeHeaders(req.headers);
    // The body is sent again as JSON below, so the original length no longer applies
    headers.delete('content-length');
    if (hasBody) headers.set('content-type', 'application/json');

    const response = await this.authService.auth.handler(
      new Request(new URL(req.originalUrl, this.config.get('BETTER_AUTH_URL', { infer: true })), {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      }),
    );

    if (!response.ok) {
      throw await this.toApiException(response);
    }

    // Copy Better Auth's response, including the session cookie (Set-Cookie)
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) res.setHeader('set-cookie', cookies);
    res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  }

  private async toApiException(response: globalThis.Response): Promise<ApiException> {
    const errorBody = (await response.json().catch(() => ({}))) as { code?: unknown };
    const code =
      typeof errorBody.code === 'string'
        ? errorBody.code
        : ((HttpStatus[response.status] as string | undefined) ?? 'ERROR');
    const field = fieldForErrorCode[code];

    return new ApiException(response.status, code, field ? [{ field, key: `errors:${code}` }] : []);
  }
}
