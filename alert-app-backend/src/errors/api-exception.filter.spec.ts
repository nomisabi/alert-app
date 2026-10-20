import { HttpStatus, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiException } from './api.exception.js';

/** Runs the filter like Nest does and returns the status, body and extra headers it sent. */
function runFilter(exception: unknown, headers: Record<string, string> = {}) {
  const response = { status: vi.fn(), json: vi.fn(), set: vi.fn() };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new ApiExceptionFilter().catch(exception, host);

  const [[status]] = response.status.mock.calls as [[number]];
  const [[body]] = response.json.mock.calls as [[unknown]];
  const sentHeaders = (response.set.mock.calls as [[Record<string, string>]][])[0]?.[0];
  return { status, body, ...(sentHeaders && { headers: sentHeaders }) };
}

describe('ApiExceptionFilter', () => {
  beforeEach(() => {
    // Unexpected errors are logged; keep the test output clean
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('translates an ApiException with field errors', () => {
    const exception = new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', [
      { field: 'username', key: 'validation:username.tooShort' },
    ]);

    expect(runFilter(exception, { 'accept-language': 'en-US' })).toEqual({
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'Please check the highlighted fields.',
        fieldErrors: [{ field: 'username', message: 'Use at least 6 characters.' }],
      },
    });
  });

  it('leaves out fieldErrors when there are none', () => {
    const exception = new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_EMAIL_OR_PASSWORD');

    expect(runFilter(exception)).toEqual({
      status: 401,
      body: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password.' },
    });
  });

  it("turns Nest's own errors into our format", () => {
    expect(runFilter(new NotFoundException())).toEqual({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found.' },
    });
  });

  it('hides the details of unexpected errors', () => {
    expect(runFilter(new Error('database password is wrong'))).toEqual({
      status: 500,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong. Please try again later.',
      },
    });
  });

  it('fills in values and sets extra headers', () => {
    const exception = new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'CHANNEL_TEST_TOO_SOON', [], {
      values: { seconds: 42 },
      headers: { 'Retry-After': '42' },
    });

    expect(runFilter(exception)).toEqual({
      status: 429,
      body: {
        code: 'CHANNEL_TEST_TOO_SOON',
        message: 'You can send one test message per minute. Please try again in 42 seconds.',
      },
      headers: { 'Retry-After': '42' },
    });
  });

  it('falls back to the status text for unknown codes', () => {
    const exception = new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'SOMETHING_NEW');

    expect(runFilter(exception).body).toEqual({
      code: 'SOMETHING_NEW',
      message: 'The request could not be processed.',
    });
  });
});
