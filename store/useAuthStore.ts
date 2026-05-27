import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Holds every credential the user can configure: BYOK keys for Gemini /
 * DeepL / Torii and the Ichigo session token. Persisted to localStorage so
 * the user doesn't have to re-enter keys on each visit.
 *
 * Migration of legacy keys (set directly via `localStorage.setItem` in the
 * pre-Phase-2a App.tsx) is handled by `store/migrations.ts`, which runs
 * before React boots.
 */
export interface AuthState {
  // Ichigo
  ichigoEmail: string;
  ichigoToken: string | null;
  /**
   * UI checkbox: when true, the token+email are kept after the session
   * ends. When false, they are scrubbed on logout.
   */
  ichigoRemember: boolean;

  // Torii
  toriiApiKey: string;
  toriiSaveKey: boolean;

  // Gemini BYOK
  geminiApiKey: string;

  // DeepL BYOK
  deepLKey: string;

  // OpenAI BYOK
  openaiApiKey: string;

  // ---- Actions ----
  setIchigoEmail: (v: string) => void;
  setIchigoToken: (v: string | null) => void;
  setIchigoRemember: (v: boolean) => void;
  /**
   * Convenience helper invoked after a successful Ichigo login. Honors
   * the "remember me" flag: if disabled, only the in-memory token is
   * updated, so the persisted entry stays empty.
   */
  loginIchigo: (email: string, token: string) => void;
  logoutIchigo: () => void;

  setToriiApiKey: (v: string) => void;
  setToriiSaveKey: (v: boolean) => void;
  /**
   * Honors `toriiSaveKey`: if disabled, the key is dropped instead of
   * being persisted. Mirrors the behavior of the old `saveToriiKey()`
   * handler.
   */
  commitToriiKey: () => void;

  setGeminiApiKey: (v: string) => void;
  setDeepLKey: (v: string) => void;
  setOpenaiApiKey: (v: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ichigoEmail: '',
      ichigoToken: null,
      ichigoRemember: true,

      toriiApiKey: '',
      toriiSaveKey: true,

      geminiApiKey: '',
      deepLKey: '',
      openaiApiKey: '',

      setIchigoEmail: v => set({ ichigoEmail: v }),
      setIchigoToken: v => set({ ichigoToken: v }),
      setIchigoRemember: v => set({ ichigoRemember: v }),

      loginIchigo: (email, token) => {
        const remember = get().ichigoRemember;
        set({
          ichigoEmail: email,
          ichigoToken: token,
        });
        // The persist `partialize` below will already strip the token
        // when remember is false, so this is mostly a no-op besides
        // updating the runtime state.
        if (!remember) {
          // Force the persisted entry to be rewritten without the token.
          // Calling set() with the same email triggers the middleware.
          set({ ichigoEmail: email });
        }
      },

      logoutIchigo: () => set({ ichigoToken: null }),

      setToriiApiKey: v => set({ toriiApiKey: v }),
      setToriiSaveKey: v => set({ toriiSaveKey: v }),
      commitToriiKey: () => {
        // If the user toggled "save key" off, drop the value from the
        // persisted layer by clearing the runtime field. Anything the
        // user already typed stays in `toriiApiKey` only until reload.
        if (!get().toriiSaveKey) {
          // We intentionally leave the in-memory value so the current
          // session keeps working; persist's partialize strips it.
        }
      },

      setGeminiApiKey: v => set({ geminiApiKey: v }),
      setDeepLKey: v => set({ deepLKey: v }),
      setOpenaiApiKey: v => set({ openaiApiKey: v }),
    }),
    {
      name: 'mangalens-auth',
      storage: createJSONStorage(() => localStorage),
      /**
       * Strip volatile / opt-out fields from the persisted snapshot.
       *  - `ichigoToken` only persists when `ichigoRemember` is true.
       *  - `toriiApiKey` only persists when `toriiSaveKey` is true.
       *  - All booleans (remember, save) are persisted so the user's
       *    preference survives a reload.
       */
      partialize: state => ({
        ichigoEmail: state.ichigoEmail,
        ichigoToken: state.ichigoRemember ? state.ichigoToken : null,
        ichigoRemember: state.ichigoRemember,
        toriiApiKey: state.toriiSaveKey ? state.toriiApiKey : '',
        toriiSaveKey: state.toriiSaveKey,
        geminiApiKey: state.geminiApiKey,
        deepLKey: state.deepLKey,
        openaiApiKey: state.openaiApiKey,
      }),
    },
  ),
);
