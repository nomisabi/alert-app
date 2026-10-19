import type { AuthUser } from '@alert-app/shared';
import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception.js';
import { AuthService } from './auth.service.js';

/** A request that passed AuthGuard: `user` is the logged-in user. */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Lets the request through only with a valid session cookie (401 otherwise),
 * and puts the user on `request.user`.
 *
 * @example @UseGuards(AuthGuard)
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.getUser(request.headers);
    if (!user) throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');

    request.user = user;
    return true;
  }
}

/**
 * Lets the request through only for admins (403 otherwise). Must come after AuthGuard.
 *
 * @example @UseGuards(AuthGuard, AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
    if (request.user?.role !== 'admin') throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN');

    return true;
  }
}
