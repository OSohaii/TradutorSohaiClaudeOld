import React from 'react';

import FontManagerModal from '../../features/settings/FontManagerModal';
import IchigoSettingsModal from '../../features/settings/IchigoSettingsModal';
import ToriiSettingsModal from '../../features/settings/ToriiSettingsModal';
import DeepLSettingsModal from '../../features/settings/DeepLSettingsModal';
import GeminiSettingsModal from '../../features/settings/GeminiSettingsModal';
import OpenAISettingsModal from '../../features/settings/OpenAISettingsModal';
import SettingsPanel from '../../features/settings/SettingsPanel';
import LibraryManager from '../LibraryManager';
import OnboardingModal from '../OnboardingModal';
import ToastContainer from '../ui/Toast';
import { ProcessedImage } from '../../types';
import { useSessionStore } from '../../store';

export interface SettingsModalsHostState {
  ichigo: boolean;
  torii: boolean;
  deepl: boolean;
  gemini: boolean;
  openai: boolean;
  fonts: boolean;
  settings: boolean;
  library: boolean;
  onboarding: boolean;
}

export interface SettingsModalsHostHandlers {
  closeIchigo: () => void;
  closeTorii: () => void;
  closeDeepL: () => void;
  closeGemini: () => void;
  closeOpenAI: () => void;
  closeFonts: () => void;
  closeSettings: () => void;
  closeLibrary: () => void;
  closeOnboarding: () => void;

  /** Re-open Ichigo settings from inside the unified SettingsPanel. */
  openIchigoFromSettings: () => void;
  /** Replace the current session with a chapter loaded from the library. */
  onLoadFromLibrary: (images: ProcessedImage[]) => void;
}

interface SettingsModalsHostProps {
  show: SettingsModalsHostState;
  handlers: SettingsModalsHostHandlers;
}

/**
 * Renders every floating UI surface that lives at the application root:
 * settings modals, the library manager, the toast container and the
 * onboarding modal.
 *
 * Visibility state remains owned by `App.tsx` (since the translation
 * pipeline's `onAuthError` callback also needs to flip these flags) but the
 * JSX wiring is encapsulated here to keep `App.tsx` focused on orchestration.
 */
const SettingsModalsHost: React.FC<SettingsModalsHostProps> = ({ show, handlers }) => {
  const history = useSessionStore(s => s.history);

  return (
    <>
      <FontManagerModal isOpen={show.fonts} onClose={handlers.closeFonts} />
      <IchigoSettingsModal isOpen={show.ichigo} onClose={handlers.closeIchigo} />
      <ToriiSettingsModal isOpen={show.torii} onClose={handlers.closeTorii} />
      <DeepLSettingsModal isOpen={show.deepl} onClose={handlers.closeDeepL} />
      <GeminiSettingsModal isOpen={show.gemini} onClose={handlers.closeGemini} />
      <OpenAISettingsModal isOpen={show.openai} onClose={handlers.closeOpenAI} />
      <SettingsPanel
        isOpen={show.settings}
        onClose={handlers.closeSettings}
        onOpenIchigoLogin={handlers.openIchigoFromSettings}
      />

      <LibraryManager
        isOpen={show.library}
        onClose={handlers.closeLibrary}
        currentHistory={history}
        onLoadChapter={handlers.onLoadFromLibrary}
      />

      <ToastContainer />

      <OnboardingModal forceOpen={show.onboarding} onClose={handlers.closeOnboarding} />
    </>
  );
};

export default SettingsModalsHost;
