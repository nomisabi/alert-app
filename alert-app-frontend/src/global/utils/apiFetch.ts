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
export function apiFetch<T>(path: string, { method = 'GET', json }: ApiFetchOptions = {}) {
  return request<T>(path, {
    method,
    headers: json === undefined ? {} : { 'Content-Type': 'application/json' },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

/**
 * The same, in the shape Orval's generated code calls it (see orval.config.ts):
 * the generated functions build the URL and the fetch options, this sends them.
 */
export function orvalFetch<T>(url: string, init: RequestInit): Promise<T> {
  return request<T>(url, init);
}

/**
 * Orval reads these two names from this file: the error type of the generated hooks, and request
 * bodies as-is. Every failed request throws ApiRequestError, whatever error the spec describes
 * (the `extends` only uses the parameter, which Orval passes but we don't need).
 */
export type ErrorType<Error> = Error extends unknown ? ApiRequestError : ApiRequestError;
export type BodyType<Body> = Body;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  // new Headers(): init.headers can be a plain object or a Headers instance
  const headers = new Headers(init.headers);
  headers.set('Accept-Language', i18n.language);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
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
