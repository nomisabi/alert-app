import {
  createChannelRequestSchema,
  updateChannelRequestSchema,
  type Channel,
  type ChannelList,
} from '@alert-app/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { parseBody } from '../errors/api.exception.js';
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

  @Post()
  @ApiOperation({
    operationId: 'createChannel',
    summary:
      'Connect Slack (one per user). Sends the test message first, saves only if Slack accepts it.',
  })
  @ApiBody({ schema: schemaRef('CreateChannelRequest') })
  @ApiCreatedResponse({
    schema: schemaRef('Channel'),
    description: 'The new channel (without the webhook URL)',
  })
  @ApiBadRequestResponse({
    description:
      'VALIDATION_FAILED, or SLACK_WEBHOOK_INVALID (on webhookUrl): Slack rejected the test message',
  })
  @ApiConflictResponse({ description: 'SLACK_ALREADY_CONNECTED: the user already has Slack' })
  @ApiBadGatewayResponse({ description: 'CHANNEL_TEST_FAILED: Slack failed or did not answer' })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<Channel> {
    const language = pickLanguage(request.headers['accept-language']);
    return this.channels.create(
      request.user.id,
      parseBody(createChannelRequestSchema, body),
      language,
    );
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateChannel',
    summary:
      'Edit the Slack channel. Only the sent fields change; a new webhook URL gets the test message first.',
  })
  @ApiBody({ schema: schemaRef('UpdateChannelRequest') })
  @ApiOkResponse({
    schema: schemaRef('Channel'),
    description: 'The channel after the change (without the webhook URL)',
  })
  @ApiBadRequestResponse({
    description:
      'VALIDATION_FAILED, CHANNEL_NOT_EDITABLE (the email channel), or SLACK_WEBHOOK_INVALID (on webhookUrl)',
  })
  @ApiNotFoundResponse({
    description: "CHANNEL_NOT_FOUND: no such channel, or it's another user's",
  })
  @ApiTooManyRequestsResponse({
    description:
      'CHANNEL_TEST_TOO_SOON: a new webhook URL counts as a test message (one per minute, see Retry-After)',
  })
  @ApiBadGatewayResponse({ description: 'CHANNEL_TEST_FAILED: Slack failed or did not answer' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Channel> {
    const language = pickLanguage(request.headers['accept-language']);
    return this.channels.update(
      request.user.id,
      id,
      parseBody(updateChannelRequestSchema, body),
      language,
    );
  }

  // POST, not GET: it has a side effect (an email). GET requests may be repeated or preloaded.
  @Post(':id/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sendChannelTest',
    summary: 'Send a test message (one per channel per minute)',
  })
  @ApiNoContentResponse({ description: 'Sent' })
  @ApiBadRequestResponse({
    description: 'SLACK_WEBHOOK_REMOVED: Slack refused the saved webhook (edit it to fix)',
  })
  @ApiNotFoundResponse({
    description: "CHANNEL_NOT_FOUND: no such channel, or it's another user's",
  })
  @ApiTooManyRequestsResponse({
    description: 'CHANNEL_TEST_TOO_SOON: the Retry-After header says how many seconds to wait',
  })
  @ApiBadGatewayResponse({ description: 'CHANNEL_TEST_FAILED: the email service or Slack failed' })
  sendTest(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    // The email is written in the language the frontend asks for (English only for now)
    const language = pickLanguage(request.headers['accept-language']);
    return this.channels.sendTest(request.user.id, id, language);
  }
}
