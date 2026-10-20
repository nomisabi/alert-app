import type { FetchNewsResponse } from '@alert-app/shared';
import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, AuthGuard } from '../auth/auth.guard.js';
import { schemaRef } from '../openapi/zod-openapi.js';
import { NewsSourcesService } from './news-sources.service.js';

@ApiTags('admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@ApiForbiddenResponse({ description: 'Logged in, but not an admin' })
@Controller('admin/news-sources')
@UseGuards(AuthGuard, AdminGuard)
export class NewsSourcesController {
  constructor(private readonly newsSources: NewsSourcesService) {}

  @Post('fetch')
  // 202 Accepted: the fetch is queued, the worker runs it a moment later
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'fetchNewsNow',
    summary: 'Fetch news now (for development). Repeats the batchId while a fetch is queued.',
  })
  @ApiAcceptedResponse({ schema: schemaRef('FetchNewsResponse') })
  @ApiServiceUnavailableResponse({ description: 'NEWS_SOURCE_NOT_CONFIGURED: no NEWSDATA_API_KEY' })
  fetchNow(): Promise<FetchNewsResponse> {
    return this.newsSources.fetchNow();
  }
}
