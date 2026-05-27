/**
 * Shared types for the layout components.
 *
 * `ModalOpeners` lets the parent expose a single object of callbacks to open
 * each settings/utility modal. Keeping the shape stable here avoids prop
 * drilling drift between Sidebar / SettingsModalsHost / App.
 */
export interface ModalOpeners {
  ichigo: () => void;
  torii: () => void;
  deepl: () => void;
  gemini: () => void;
  openai: () => void;
  fonts: () => void;
  library: () => void;
  settings: () => void;
  onboarding: () => void;
}
