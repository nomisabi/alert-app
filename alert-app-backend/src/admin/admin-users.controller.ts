import {
  adminUserListQuerySchema,
  updateAdminUserRequestSchema,
  type AdminUser,
  type AdminUserList,
} from '@alert-app/shared';
import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { parseBody } from '../errors/api.exception.js';
import { ApiQueryFromZod, schemaRef } from '../openapi/zod-openapi.js';
import { AdminUsersService } from './admin-users.service.js';

@ApiTags('admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@ApiForbiddenResponse({ description: 'Logged in, but not an admin' })
@Controller('admin/users')
// Guards run in this order: first "logged in?", then "admin?"
@UseGuards(AuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  // operationId = the function name Orval generates (getAdminUsers → useGetAdminUsers)
  @Get()
  @ApiOperation({ operationId: 'getAdminUsers', summary: 'List users (newest first)' })
  @ApiQueryFromZod(adminUserListQuerySchema)
  @ApiOkResponse({ schema: schemaRef('AdminUserList') })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED: invalid query parameters' })
  list(@Query() query: unknown): Promise<AdminUserList> {
    // Query values arrive as text: the schema turns page=2 into a number and fills in defaults
    return this.adminUsers.list(parseBody(adminUserListQuerySchema, query));
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateAdminUser',
    summary: 'Change role and/or disabled. Only the fields in the body change.',
  })
  @ApiBody({ schema: schemaRef('UpdateAdminUserRequest') })
  @ApiOkResponse({ schema: schemaRef('AdminUser'), description: 'The user after the change' })
  @ApiBadRequestResponse({
    description: 'CANNOT_CHANGE_OWN_ROLE, CANNOT_DISABLE_SELF or VALIDATION_FAILED',
  })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<AdminUser> {
    return this.adminUsers.update(
      request.user.id,
      id,
      parseBody(updateAdminUserRequestSchema, body),
    );
  }
}
