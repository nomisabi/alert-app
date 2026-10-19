import { HttpStatus, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiException } from './api.exception.js';

/** Runs the filter like Nest does and returns the status and body it sent. */
function runFilter(exception: unknown, headers: Record<string, string> = {}) {
  const response = { status: vi.fn(), json: vi.fn() };
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
  return { status, body };
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

  it('falls back to the status text for unknown codes', () => {
    const exception = new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'SOMETHING_NEW');

    expect(runFilter(exception).body).toEqual({
      code: 'SOMETHING_NEW',
      message: 'The request could not be processed.',
    });
  });
});
