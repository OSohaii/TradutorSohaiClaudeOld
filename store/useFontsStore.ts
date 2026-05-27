import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { saveFontToIDB, loadAllFontsFromIDB, clearAllFontsFromIDB } from '../services/imageStorage';

/**
 * User-uploaded fonts (TTF/OTF/WOFF). Each font lives as a base64 data
 * URL so the file is fully self-contained inside IndexedDB; on
 * rehydrate we re-register every entry with `document.fonts.add(...)`
 * so the browser actually knows how to render text in that family.
 *
 * Previously stored in localStorage (which caps out around 5 MB total).
 * Now backed by IndexedDB with automatic migration from the legacy
 * localStorage key on first load.
 */
export interface StoredFont {
  /** Family name as registered with `document.fonts.add()`. */
  name: string;
  /** CSS `font-family` value, e.g. `"Foo", sans-serif`. */
  value: string;
  /** Base64 data URL of the original font file. */
  data: string;
}

interface FontsState {
  customFonts: StoredFont[];
  /** True while a newly uploaded font is being parsed/registered. */
  isLoading: boolean;
  /** True after `registerLoadedFonts()` finished its first pass. */
  hasHydratedFontFaces: boolean;

  // ---- Actions ----
  addFont: (font: StoredFont) => Promise<void>;
  removeFont: (index: number) => void;
  setLoading: (v: boolean) => void;
  /**
   * Iterates over the persisted list and calls `document.fonts.add()`
   * for each entry. Idempotent: subsequent calls become a no-op once
   * `hasHydratedFontFaces` is true.
   */
  registerLoadedFonts: () => Promise<void>;
}

const registerOne = async (font: StoredFont): Promise<boolean> => {
  try {
    const face = new FontFace(font.name, `url(${font.data})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
    return true;
  } catch (err) {
    console.error(`[fonts] failed to register ${font.name}:`, err);
    return false;
  }
};

const idbFontStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const fonts = await loadAllFontsFromIDB();
    if (fonts.length === 0) {
      // Check legacy localStorage for migration
      const legacy = localStorage.getItem(name);
      if (legacy) {
        // Migrate to IDB
        try {
          const parsed = JSON.parse(legacy);
          if (parsed?.state?.customFonts) {
            for (const f of parsed.state.customFonts) {
              await saveFontToIDB(f);
            }
          }
          localStorage.removeItem(name);
        } catch {
          localStorage.removeItem(name);
        }
        return legacy; // Return it once so zustand hydrates
      }
      return null;
    }
    return JSON.stringify({ state: { customFonts: fonts }, version: 0 });
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    const parsed = JSON.parse(value);
    const fonts: StoredFont[] = parsed?.state?.customFonts || [];
    // Clear-and-rewrite strategy: acceptable for the expected font count
    // (< 10 custom fonts typically). A future optimization could use
    // individual put/delete operations to avoid rewriting all blobs.
    await clearAllFontsFromIDB();
    for (const f of fonts) {
      await saveFontToIDB(f);
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    await clearAllFontsFromIDB();
  },
};

export const useFontsStore = create<FontsState>()(
  persist(
    (set, get) => ({
      customFonts: [],
      isLoading: false,
      hasHydratedFontFaces: false,

      addFont: async font => {
        const ok = await registerOne(font);
        if (!ok) return;
        const next = [...get().customFonts, font];
        try {
          set({ customFonts: next });
        } catch (e) {
          console.warn('[fonts] could not persist font (quota?)', e);
        }
      },

      removeFont: index => {
        const next = get().customFonts.filter((_, i) => i !== index);
        set({ customFonts: next });
      },

      setLoading: v => set({ isLoading: v }),

      registerLoadedFonts: async () => {
        if (get().hasHydratedFontFaces) return;
        const fonts = get().customFonts;
        // Run in parallel; failures are logged inside `registerOne`.
        await Promise.all(fonts.map(registerOne));
        set({ hasHydratedFontFaces: true });
      },
    }),
    {
      name: 'mangalens-fonts',
      storage: createJSONStorage(() => idbFontStorage),
      // Persist only the actual font list. Loading flags are session-only.
      partialize: state => ({ customFonts: state.customFonts }),
    },
  ),
);
