import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, ApiError } from '../../services/api/client';

describe('apiFetch (API client)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns parsed JSON data on successful response', async () => {
    const mockData = { bubbles: [], tokens: { input: 10, output: 5 } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await apiFetch('/pipeline');
    expect(result).toEqual(mockData);
  });

  it('creates ApiError with correct code/engine/message from structured error payload', async () => {
    const errorPayload = {
      error: {
        code: 'RATE_LIMIT',
        engine: 'gemini',
        message: 'Rate limit exceeded',
        recoverable: true,
      },
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => errorPayload,
    });

    const err = await apiFetch('/pipeline').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe('RATE_LIMIT');
    expect(apiErr.engine).toBe('gemini');
    expect(apiErr.message).toBe('Rate limit exceeded');
    expect(apiErr.httpStatus).toBe(429);
    expect(apiErr.recoverable).toBe(true);
  });

  it('creates INVALID_INPUT error from 422 response with detail field', async () => {
    const payload = { detail: [{ loc: ['body', 'imageBase64'], msg: 'field required' }] };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => payload,
    });

    const err = await apiFetch('/pipeline').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe('INVALID_INPUT');
    expect(apiErr.httpStatus).toBe(422);
  });

  it('creates NETWORK error when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));

    const err = await apiFetch('/pipeline').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe('NETWORK');
    expect(apiErr.engine).toBe('pipeline');
    expect(apiErr.httpStatus).toBe(0);
  });

  it('attaches BYOK headers when provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    await apiFetch('/health', {
      byok: { gemini: 'my-key', deepl: 'deepl-key' },
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['X-Byok-Gemini']).toBe('my-key');
    expect(init.headers['X-Byok-Deepl']).toBe('deepl-key');
  });
});
