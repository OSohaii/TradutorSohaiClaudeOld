/**
 * High-level API surface for talking to the MangaLens BFF.
 *
 * These functions are the only way the frontend touches translation
 * providers. The actual external calls (Gemini SDK, Ichigo, Torii, DeepL,
 * Google Translate) all happen on the server, so no provider keys are ever
 * embedded in the bundle.
 */
import { TextBubble, EngineId } from '../../types';
import { ApiError, ByokKeys, apiFetch } from './client';

// ---------------------------------------------------------------------------
// Wire types — must mirror the Pydantic schemas in backend/app/schemas/.
// ---------------------------------------------------------------------------

export interface OcrConfig {
  engine: EngineId;
}

export interface TranslationConfig {
  engine: EngineId;
}

export interface CleanerConfig {
  enabled: boolean;
  engine?: EngineId;
}

export interface PipelineOptions {
  targetLanguage?: string;
  targetLangCode?: string;
  ichigoModel?: string;
  sourceLanguage?: string;
}

export interface PipelineRequest {
  imageBase64: string;
  ocr: OcrConfig;
  translation: TranslationConfig;
  cleaner?: CleanerConfig;
  options?: PipelineOptions;
  phase?: 'full' | 'ocr-only' | 'translate-only';
  bubbles?: TextBubble[];
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  model: string;
  engine?: string;
}

export interface PipelineResponse {
  bubbles: TextBubble[];
  translatedImageBase64?: string;
  cleanedImageBase64?: string;
  tokens?: TokenUsage;
  warnings?: string[];
  plan?: Record<string, unknown>;
}

export interface TranslateRequest {
  bubbles: TextBubble[];
  engine: EngineId;
}

export interface TranslateResponse {
  bubbles: TextBubble[];
  tokens?: TokenUsage;
}

export interface IchigoLoginResponse {
  accessToken: string;
}

export interface HealthResponse {
  status: 'ok';
  environment: string;
  providers: Record<'gemini' | 'deepl' | 'torii' | 'google' | 'ichigo', boolean>;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** Run OCR + translation (and optional Torii cleaner) on a manga page. */
export function runPipeline(req: PipelineRequest, byok?: ByokKeys): Promise<PipelineResponse> {
  return apiFetch<PipelineResponse>('/pipeline', {
    method: 'POST',
    body: req,
    byok,
  });
}

/** Translate already-extracted bubbles (e.g. for re-translation in the editor). */
export function translateBubbles(
  bubbles: TextBubble[],
  engine: EngineId,
  byok?: ByokKeys,
): Promise<TranslateResponse> {
  // Strip UI-only fields so the request stays small. The backend ignores
  // unknown fields anyway, but this avoids leaking client preferences.
  const slim = bubbles.map(({ id, originalText, translatedText, box, type }) => ({
    id,
    originalText,
    translatedText,
    box,
    type: type ?? 'dialogue',
  }));
  return apiFetch<TranslateResponse>('/translate', {
    method: 'POST',
    body: { bubbles: slim, engine },
    byok,
  });
}

/**
 * Exchange Ichigo credentials for a bearer token. The token is returned to
 * the caller, which is responsible for storing it (typically in localStorage)
 * and sending it as the X-Byok-Ichigo header on subsequent requests.
 */
export function ichigoLogin(email: string, password: string): Promise<IchigoLoginResponse> {
  return apiFetch<IchigoLoginResponse>('/ichigo/login', {
    method: 'POST',
    body: { email, password },
  });
}

/** Liveness probe; useful for surfacing which providers have a server key. */
export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

// ---------------------------------------------------------------------------
// Image fetch (CORS proxy bypass via BFF)
// ---------------------------------------------------------------------------

interface FetchImageApiResponse {
  base64: string;
  content_type: string;
  filename: string;
}

/** Download an image via the BFF (avoids CORS). */
export async function fetchImageViaProxy(url: string): Promise<{ base64: string; contentType: string; filename: string }> {
  const resp = await apiFetch<FetchImageApiResponse>('/fetch-image', {
    method: 'POST',
    body: { url },
  });
  return { base64: resp.base64, contentType: resp.content_type, filename: resp.filename };
}

// Re-export so call sites only need this module.
export { ApiError } from './client';
export type { ByokKeys } from './client';
export type { EngineId } from '../../types';
