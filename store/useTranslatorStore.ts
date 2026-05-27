import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { EngineId } from '../types';

/**
 * Engine selectors and rendering preferences. None of these are secret,
 * so the whole state is persisted as-is. Pre-Phase-2a these were 11
 * separate `useEffect` blocks pushing each field into its own
 * localStorage key; with zustand's persist middleware it collapses into
 * one declarative entry.
 */

export interface TranslatorState {
  ocrEngine: EngineId;
  transEngine: EngineId;
  ichigoModel: string;

  sourceLanguage: string;
  targetLanguage: string;
  targetLangCode: string;

  targetFont: string;
  targetBold: boolean;
  targetItalic: boolean;

  globalBubbleScale: number;

  // Torii advanced
  toriiInternalTrans: string;
  toriiStrokeDisabled: boolean;
  toriiInpaintOnly: boolean;
  /**
   * When the active OCR/translator engine isn't Torii itself, the user
   * can still opt in to a Torii inpaint pass that wipes the original
   * text from the image so the translated bubbles are layered on a
   * clean background.
   */
  useToriiForCleaning: boolean;

  /**
   * When true (default), uploaded images are immediately sent through
   * the translation pipeline. When false, they are queued with status
   * 'idle' so the user can trigger translation manually.
   */
  autoTranslate: boolean;

  /** Whether the desktop sidebar is collapsed to icon-only mode. */
  sidebarCollapsed: boolean;

  // ---- Actions ----
  setOcrEngine: (v: EngineId) => void;
  setTransEngine: (v: EngineId) => void;
  setIchigoModel: (v: string) => void;

  setSourceLanguage: (v: string) => void;
  setTargetLanguage: (v: string) => void;
  setTargetLangCode: (v: string) => void;

  setTargetFont: (v: string) => void;
  setTargetBold: (v: boolean) => void;
  setTargetItalic: (v: boolean) => void;

  setGlobalBubbleScale: (v: number) => void;

  setToriiInternalTrans: (v: string) => void;
  setToriiStrokeDisabled: (v: boolean) => void;
  setToriiInpaintOnly: (v: boolean) => void;
  setUseToriiForCleaning: (v: boolean) => void;
  setAutoTranslate: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

/**
 * Default font value: kept as an empty string here and overwritten at
 * boot by App.tsx after `MangaViewer` exports `DEFAULT_FONT_VALUE`. We
 * can't import that here because doing so would force this store to
 * pull the entire viewer module just to seed a literal.
 */
export const useTranslatorStore = create<TranslatorState>()(
  persist(
    set => ({
      ocrEngine: 'GEMINI_FLASH',
      transEngine: 'GEMINI_35_FLASH',
      ichigoModel: 'Gemini 3 Pro',

      sourceLanguage: 'Japanese',
      targetLanguage: 'Portugues (Brasil)',
      targetLangCode: 'pt-BR',

      targetFont: '',
      targetBold: true,
      targetItalic: false,

      globalBubbleScale: 1.0,

      toriiInternalTrans: 'google_translate',
      toriiStrokeDisabled: false,
      toriiInpaintOnly: false,
      useToriiForCleaning: false,
      autoTranslate: true,
      sidebarCollapsed: false,

      setOcrEngine: v => set({ ocrEngine: v }),
      setTransEngine: v => set({ transEngine: v }),
      setIchigoModel: v => set({ ichigoModel: v }),

      setSourceLanguage: v => set({ sourceLanguage: v }),
      setTargetLanguage: v => set({ targetLanguage: v }),
      setTargetLangCode: v => set({ targetLangCode: v }),

      setTargetFont: v => set({ targetFont: v }),
      setTargetBold: v => set({ targetBold: v }),
      setTargetItalic: v => set({ targetItalic: v }),

      setGlobalBubbleScale: v => set({ globalBubbleScale: v }),

      setToriiInternalTrans: v => set({ toriiInternalTrans: v }),
      setToriiStrokeDisabled: v => set({ toriiStrokeDisabled: v }),
      setToriiInpaintOnly: v => set({ toriiInpaintOnly: v }),
      setUseToriiForCleaning: v => set({ useToriiForCleaning: v }),
      setAutoTranslate: v => set({ autoTranslate: v }),
      setSidebarCollapsed: v => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'mangalens-translator',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
