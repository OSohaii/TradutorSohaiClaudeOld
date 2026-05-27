/**
 * One-shot migration of legacy `localStorage` keys (set by direct
 * `setItem` calls scattered across App.tsx pre-Phase-2a) into the
 * zustand-managed entries used by `useAuthStore`, `useTranslatorStore`
 * and `useFontsStore`.
 *
 * This runs once, before React mounts. It is idempotent: if a zustand
 * entry already exists, we don't overwrite it. Once the legacy values
 * have been copied (or were absent), the legacy keys are removed so
 * the localStorage stays clean for new users.
 */

const LEGACY_AUTH_KEYS = [
  'ichigo_email',
  'ichigo_token',
  'torii_key',
  'gemini_api_key',
  'google_api_key', // even older alias for the gemini key
  'deepl_key',
] as const;

const LEGACY_TRANSLATOR_KEYS = [
  'manga_ocr_engine',
  'manga_trans_engine',
  'manga_ichigo_model',
  'manga_target_font',
  'manga_target_bold',
  'manga_target_italic',
  'manga_bubble_scale',
  'manga_torii_trans',
  'manga_torii_stroke',
  'manga_torii_inpaint',
  'manga_torii_cleaning',
] as const;

const LEGACY_FONTS_KEY = 'manga_custom_fonts';

const ZUSTAND_AUTH_KEY = 'mangalens-auth';
const ZUSTAND_TRANSLATOR_KEY = 'mangalens-translator';
const ZUSTAND_FONTS_KEY = 'mangalens-fonts';

const MIGRATION_FLAG = 'mangalens-legacy-migrated-v1';

const safeRead = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('[migrations] failed to write', key, e);
  }
};

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

const parseBool = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) return fallback;
  return raw === 'true';
};

const parseFloatOr = (raw: string | null, fallback: number): number => {
  if (raw === null) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const migrateLegacyLocalStorage = (): void => {
  if (typeof window === 'undefined') return;
  if (safeRead(MIGRATION_FLAG) === '1') return;

  // ---- Auth store ----
  if (!safeRead(ZUSTAND_AUTH_KEY)) {
    const ichigoEmail = safeRead('ichigo_email') ?? '';
    const ichigoToken = safeRead('ichigo_token');
    // Older code used `google_api_key` as the localStorage entry for what
    // the UI called "Gemini API key". Prefer the newer name when both exist.
    const geminiApiKey =
      safeRead('gemini_api_key') ?? safeRead('google_api_key') ?? '';
    const toriiApiKey = safeRead('torii_key') ?? '';
    const deepLKey = safeRead('deepl_key') ?? '';

    const hasAny =
      ichigoEmail || ichigoToken || geminiApiKey || toriiApiKey || deepLKey;

    if (hasAny) {
      const payload = {
        state: {
          ichigoEmail,
          ichigoToken: ichigoToken ?? null,
          // If a token was persisted, the old code persisted with the
          // "remember me" checkbox on, so reflect that here.
          ichigoRemember: !!ichigoToken,
          toriiApiKey,
          // Old code wrote/removed the key based on this flag. If a key
          // exists at migration time, the user wanted it persisted.
          toriiSaveKey: !!toriiApiKey,
          geminiApiKey,
          deepLKey,
        },
        version: 0,
      };
      safeWrite(ZUSTAND_AUTH_KEY, JSON.stringify(payload));
    }
  }

  // ---- Translator store ----
  if (!safeRead(ZUSTAND_TRANSLATOR_KEY)) {
    const partial = {
      ocrEngine: safeRead('manga_ocr_engine'),
      transEngine: safeRead('manga_trans_engine'),
      ichigoModel: safeRead('manga_ichigo_model'),
      targetFont: safeRead('manga_target_font'),
      targetBold: safeRead('manga_target_bold'),
      targetItalic: safeRead('manga_target_italic'),
      globalBubbleScale: safeRead('manga_bubble_scale'),
      toriiInternalTrans: safeRead('manga_torii_trans'),
      toriiStrokeDisabled: safeRead('manga_torii_stroke'),
      toriiInpaintOnly: safeRead('manga_torii_inpaint'),
      useToriiForCleaning: safeRead('manga_torii_cleaning'),
    };

    const hasAny = Object.values(partial).some(v => v !== null);
    if (hasAny) {
      const payload = {
        state: {
          ocrEngine: partial.ocrEngine ?? 'GEMINI_FLASH',
          transEngine: partial.transEngine ?? 'GEMINI_35_FLASH',
          ichigoModel: partial.ichigoModel ?? 'Gemini 3 Pro',
          targetFont: partial.targetFont ?? '',
          // Original default for bold was true (`!== 'false'`).
          targetBold: parseBool(partial.targetBold, true),
          targetItalic: parseBool(partial.targetItalic, false),
          globalBubbleScale: parseFloatOr(partial.globalBubbleScale, 1.0),
          toriiInternalTrans: partial.toriiInternalTrans ?? 'google_translate',
          toriiStrokeDisabled: parseBool(partial.toriiStrokeDisabled, false),
          toriiInpaintOnly: parseBool(partial.toriiInpaintOnly, false),
          useToriiForCleaning: parseBool(partial.useToriiForCleaning, false),
        },
        version: 0,
      };
      safeWrite(ZUSTAND_TRANSLATOR_KEY, JSON.stringify(payload));
    }
  }

  // ---- Fonts store ----
  // We just copy the raw JSON over; useFontsStore decodes it on rehydrate.
  if (!safeRead(ZUSTAND_FONTS_KEY)) {
    const raw = safeRead(LEGACY_FONTS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const payload = {
            state: { customFonts: parsed },
            version: 0,
          };
          safeWrite(ZUSTAND_FONTS_KEY, JSON.stringify(payload));
        }
      } catch (e) {
        console.warn('[migrations] custom fonts JSON corrupt, skipping', e);
      }
    }
  }

  // ---- Cleanup legacy entries ----
  for (const k of LEGACY_AUTH_KEYS) safeRemove(k);
  for (const k of LEGACY_TRANSLATOR_KEYS) safeRemove(k);
  safeRemove(LEGACY_FONTS_KEY);

  // Mark as done so future boots skip the work.
  safeWrite(MIGRATION_FLAG, '1');
};
