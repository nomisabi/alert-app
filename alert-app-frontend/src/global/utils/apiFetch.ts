import type { ApiError } from '@alert-app/shared';
import i18n from '../../i18n';

/** Thrown by apiFetch for every failed request. `body` is the backend's (translated) error. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: ApiError;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON. */
  json?: unknown;
}

/**
 * Calls our backend. In development, Vite forwards /api to the backend (see vite.config.ts),
 * so the browser sends the session cookie automatically.
 * Sends the app's language, so error messages come back translated.
 */
export async function apiFetch<T>(path: string, { method = 'GET', json }: ApiFetchOptions = {}) {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        'Accept-Language': i18n.language,
        ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    // No answer at all (offline, backend down): there is no server message to show
    throw new ApiRequestError(0, { code: 'NETWORK_ERROR', message: i18n.t('errors.network') });
  }

  const data = parseJson(await response.text());

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      isApiError(data) ? data : { code: 'UNKNOWN_ERROR', message: i18n.t('errors.unexpected') },
    );
  }

  return data as T;
}

/** Not every response is JSON, e.g. an error page from a proxy. */
function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isApiError(data: unknown): data is ApiError {
  return typeof data === 'object' && data !== null && 'code' in data && 'message' in data;
}
