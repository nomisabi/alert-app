import {
  createAlertRuleRequestSchema,
  updateAlertRuleRequestSchema,
  type AlertRule,
  type AlertRuleList,
} from '@alert-app/shared';
import {
  Body,
  Controller,
  Delete,
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
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { parseBody } from '../errors/api.exception.js';
import { schemaRef } from '../openapi/zod-openapi.js';
import { AlertRulesService } from './alert-rules.service.js';

const notFound = { description: "ALERT_RULE_NOT_FOUND: no such rule, or it's another user's" };

@ApiTags('alert-rules')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@Controller('alert-rules')
@UseGuards(AuthGuard)
export class AlertRulesController {
  constructor(private readonly alertRules: AlertRulesService) {}

  @Get()
  @ApiOperation({ operationId: 'getAlertRules', summary: 'My alert rules (newest first)' })
  @ApiOkResponse({ schema: schemaRef('AlertRuleList') })
  list(@Req() request: AuthenticatedRequest): Promise<AlertRuleList> {
    return this.alertRules.list(request.user.id);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getAlertRule', summary: 'One of my alert rules' })
  @ApiOkResponse({ schema: schemaRef('AlertRule') })
  @ApiNotFoundResponse(notFound)
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<AlertRule> {
    return this.alertRules.get(request.user.id, id);
  }

  @Post()
  @ApiOperation({ operationId: 'createAlertRule', summary: 'Create an alert rule' })
  @ApiBody({ schema: schemaRef('CreateAlertRuleRequest') })
  @ApiCreatedResponse({ schema: schemaRef('AlertRule'), description: 'The new rule' })
  @ApiBadRequestResponse({
    description: 'VALIDATION_FAILED, ALERT_RULE_LIMIT_REACHED or INVALID_CHANNEL',
  })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AlertRule> {
    return this.alertRules.create(request.user.id, parseBody(createAlertRuleRequestSchema, body));
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateAlertRule',
    summary: 'Change an alert rule. Only the fields in the body change.',
  })
  @ApiBody({ schema: schemaRef('UpdateAlertRuleRequest') })
  @ApiOkResponse({ schema: schemaRef('AlertRule'), description: 'The rule after the change' })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED or INVALID_CHANNEL' })
  @ApiNotFoundResponse(notFound)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<AlertRule> {
    return this.alertRules.update(
      request.user.id,
      id,
      parseBody(updateAlertRuleRequestSchema, body),
    );
  }

  @Delete(':id')
  // 204 No Content: done, nothing to send back
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteAlertRule', summary: 'Delete an alert rule' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse(notFound)
  delete(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    return this.alertRules.delete(request.user.id, id);
  }
}
