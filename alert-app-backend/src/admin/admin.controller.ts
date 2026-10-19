import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, AuthGuard } from '../auth/auth.guard.js';

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin')
// Guards run in this order: first "logged in?", then "admin?"
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  /** Checks that the guards work. Replaced by real admin endpoints in milestone 2. */
  @Get('ping')
  @ApiOkResponse({
    description: 'The caller is a logged-in admin',
    schema: { example: { ok: true } },
  })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiForbiddenResponse({ description: 'Logged in, but not an admin' })
  ping() {
    return { ok: true };
  }
}
