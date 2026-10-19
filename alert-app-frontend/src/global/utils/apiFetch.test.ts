import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiRequestError } from './apiFetch';

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: string) {
  fetchMock.mockResolvedValue(new Response(body, { status }));
}

async function caughtError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as ApiRequestError;
  }
  throw new Error('Expected the request to fail');
}

describe('apiFetch', () => {
  vi.stubGlobal('fetch', fetchMock);

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('sends the app language and the body as JSON, and returns the parsed answer', async () => {
    respond(200, '{"ok":true}');

    await expect(apiFetch('/api/test', { method: 'POST', json: { a: 1 } })).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: { 'Accept-Language': 'en', 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
  });

  it("throws ApiRequestError with the server's error", async () => {
    const body = { code: 'FORBIDDEN', message: "You don't have permission to do this." };
    respond(403, JSON.stringify(body));

    const error = await caughtError(apiFetch('/api/test'));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(403);
    expect(error.body).toEqual(body);
    expect(error.message).toBe(body.message);
  });

  it('uses a general error when the answer is not our error format', async () => {
    respond(502, '<html>Bad Gateway</html>');

    const error = await caughtError(apiFetch('/api/test'));

    expect(error.body).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Something went wrong. Please try again later.',
    });
  });

  it('reports a network error when there is no answer at all', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await caughtError(apiFetch('/api/test'));

    expect(error.status).toBe(0);
    expect(error.body).toEqual({
      code: 'NETWORK_ERROR',
      message: "Can't reach the server. Check your connection and try again.",
    });
  });
});
