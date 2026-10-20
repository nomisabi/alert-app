import { HttpException, HttpStatus } from '@nestjs/common';
import type { z } from 'zod';

/** A field error before translation. `key` is an i18n key, e.g. `validation:username.tooShort`. */
export interface FieldErrorKey {
  field: string;
  key: string;
}

export interface ApiExceptionExtras {
  /** Values for the message text, e.g. { seconds: 42 } for "try again in {{seconds}} seconds". */
  values?: Record<string, string | number>;
  /** Extra response headers, e.g. { 'Retry-After': '42' }. */
  headers?: Record<string, string>;
}

/**
 * Throw this for every expected error. The ApiExceptionFilter turns it into the
 * `ApiError` response body (`{ code, message, fieldErrors }`) with translated texts.
 *
 * @example throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN');
 */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    readonly fieldErrors: FieldErrorKey[] = [],
    readonly extras: ApiExceptionExtras = {},
  ) {
    super(code, status);
  }
}

/**
 * Validates a request body with a (shared) Zod schema and returns the parsed value.
 * Throws a 400 VALIDATION_FAILED with one error per field. The Zod messages are keys of
 * the `validation` namespace (see packages/shared).
 */
export function parseBody<Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
): z.output<Schema> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const fieldErrors: FieldErrorKey[] = [];
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    // Only the first error per field, the same as the frontend shows
    if (fieldErrors.some((error) => error.field === field)) continue;
    fieldErrors.push({ field, key: `validation:${issue.message}` });
  }

  throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', fieldErrors);
}
