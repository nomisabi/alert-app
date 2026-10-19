import type { ApiError } from '@alert-app/shared';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { pickLanguage, translateErrorCode, translateKey } from '../i18n/i18n.js';
import { ApiException, type FieldErrorKey } from './api.exception.js';

/**
 * Catches every error thrown while handling a request and sends it in one format (`ApiError`),
 * translated into the language of the request's Accept-Language header.
 * Registered for the whole app in setup-app.ts.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const language = pickLanguage(request.headers['accept-language']);

    const { status, code, fieldErrors } = this.normalize(exception);
    const body: ApiError = {
      code,
      message: translateErrorCode(language, code, status),
    };
    if (fieldErrors.length > 0) {
      body.fieldErrors = fieldErrors.map(({ field, key }) => ({
        field,
        message: translateKey(language, key),
      }));
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    fieldErrors: FieldErrorKey[];
  } {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        fieldErrors: exception.fieldErrors,
      };
    }

    // Nest's own errors, e.g. NotFoundException for an unknown URL
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { status, code: HttpStatus[status] ?? 'ERROR', fieldErrors: [] };
    }

    // A bug or an unexpected failure: log the details, but don't send them to the browser
    this.logger.error(exception instanceof Error ? exception.stack : exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      fieldErrors: [],
    };
  }
}
