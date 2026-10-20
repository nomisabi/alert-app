import type { ChannelList } from '@alert-app/shared';
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { pickLanguage } from '../i18n/i18n.js';
import { schemaRef } from '../openapi/zod-openapi.js';
import { ChannelsService } from './channels.service.js';

@ApiTags('channels')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('channels')
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @ApiOperation({ operationId: 'getChannels', summary: 'My channels (oldest first)' })
  @ApiOkResponse({ schema: schemaRef('ChannelList') })
  list(@Req() request: AuthenticatedRequest): Promise<ChannelList> {
    return this.channels.list(request.user.id);
  }

  // POST, not GET: it has a side effect (an email). GET requests may be repeated or preloaded.
  @Post(':id/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sendChannelTest',
    summary: 'Send a test message (one per channel per minute)',
  })
  @ApiNoContentResponse({ description: 'Sent' })
  @ApiNotFoundResponse({
    description: "CHANNEL_NOT_FOUND: no such channel, or it's another user's",
  })
  @ApiTooManyRequestsResponse({
    description: 'CHANNEL_TEST_TOO_SOON: the Retry-After header says how many seconds to wait',
  })
  @ApiBadGatewayResponse({ description: 'CHANNEL_TEST_FAILED: the email service failed' })
  sendTest(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    // The email is written in the language the frontend asks for (English only for now)
    const language = pickLanguage(request.headers['accept-language']);
    return this.channels.sendTest(request.user.id, id, language);
  }
}
