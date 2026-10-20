import { APP_CATEGORIES, type CategoryList } from '@alert-app/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { schemaRef } from '../openapi/zod-openapi.js';

@ApiTags('categories')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  // From the shared list for now. The frontend loads it from here, so the list can later move to
  // the database (or depend on the enabled sources) without a frontend release.
  @Get()
  @ApiOperation({ operationId: 'getCategories', summary: 'Our news categories, in display order' })
  @ApiOkResponse({ schema: schemaRef('CategoryList') })
  list(): CategoryList {
    return { items: APP_CATEGORIES.map((id) => ({ id })) };
  }
}
