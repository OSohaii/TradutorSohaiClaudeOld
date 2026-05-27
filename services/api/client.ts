/**
 * Thin HTTP client for the MangaLens BFF.
 *
 * Two responsibilities:
 *   1. Attach BYOK ("bring your own key") headers when the user configured
 *      personal credentials. The backend uses these headers only for the
 *      single request and never persists them.
 *   2. Translate the structured `{ error: { code, engine, message, ... } }`
 *      payload from the BFF into a typed `ApiError` so the UI can react
 *      precisely (open the right settings modal, log the user out, etc.).
 */

/** Optional per-request user keys. Empty/undefined values are skipped. */
export interface ByokKeys {
  gemini?: string;
  deepl?: string;
  torii?: string;
  google?: string;
  ichigo?: string;
  openai?: string;
}

export type ApiErrorCode =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'INVALID_KEY'
  | 'INVALID_INPUT'
  | 'NETWORK'
  | 'UNKNOWN';

/** Engine identifiers attached to errors. The BFF emits short slugs (gemini,
 * ichigo, torii, deepl, google), not the EngineType enum used by the UI. */
export type ApiErrorEngine =
  | 'gemini'
  | 'ichigo'
  | 'torii'
  | 'deepl'
  | 'google'
  | 'pipeline'
  | string;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly engine: ApiErrorEngine;
  readonly recoverable: boolean;
  readonly httpStatus: number;

  constructor(args: {
    code: ApiErrorCode;
    engine: ApiErrorEngine;
    message: string;
    recoverable?: boolean;
    httpStatus: number;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.engine = args.engine;
    this.recoverable = !!args.recoverable;
    this.httpStatus = args.httpStatus;
  }
}

/** Same-origin call by default; the Vite dev server proxies /api to the
 * backend, and in production the deployment is expected to colocate the
 * static frontend with the BFF behind a single domain. */
const API_BASE = '/api';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  byok?: ByokKeys;
  signal?: AbortSignal;
}

/** Build the X-Byok-* headers, omitting empty values. */
function byokHeaders(byok?: ByokKeys): Record<string, string> {
  if (!byok) return {};
  const headers: Record<string, string> = {};
  if (byok.gemini) headers['X-Byok-Gemini'] = byok.gemini;
  if (byok.deepl) headers['X-Byok-Deepl'] = byok.deepl;
  if (byok.torii) headers['X-Byok-Torii'] = byok.torii;
  if (byok.google) headers['X-Byok-Google'] = byok.google;
  if (byok.ichigo) headers['X-Byok-Ichigo'] = byok.ichigo;
  if (byok.openai) headers['X-Byok-Openai'] = byok.openai;
  return headers;
}

/** Generic JSON request. Throws `ApiError` on non-2xx. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...byokHeaders(options.byok),
    },
    signal: options.signal,
  };

  if (options.body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err: unknown) {
    // DNS failure, server down, abort, etc.
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError({
      code: 'NETWORK',
      engine: 'pipeline',
      message: `Falha de rede ao chamar ${path}: ${message}`,
      httpStatus: 0,
    });
  }

  // 204 No Content is rare here but handle it.
  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw apiErrorFromPayload(payload, response.status);
  }

  return payload as T;
}

function apiErrorFromPayload(payload: unknown, httpStatus: number): ApiError {
  // Backend shape: { error: { code, engine, message, recoverable } }
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object'
  ) {
    const err = payload.error as Record<string, unknown>;
    return new ApiError({
      code: (err.code as ApiErrorCode) ?? 'UNKNOWN',
      engine: (err.engine as string) ?? 'pipeline',
      message: (err.message as string) ?? `HTTP ${httpStatus}`,
      recoverable: Boolean(err.recoverable),
      httpStatus,
    });
  }

  // FastAPI's default 422 validation error has shape: { detail: [...] }
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail) && detail.length > 0
        ? JSON.stringify(detail[0])
        : `HTTP ${httpStatus}`;
    return new ApiError({
      code: httpStatus === 422 ? 'INVALID_INPUT' : 'UNKNOWN',
      engine: 'pipeline',
      message,
      httpStatus,
    });
  }

  return new ApiError({
    code: 'UNKNOWN',
    engine: 'pipeline',
    message: `Erro inesperado (HTTP ${httpStatus}).`,
    httpStatus,
  });
}
