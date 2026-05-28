import React from 'react';

import UnifiedSettingsModal from '../../features/settings/UnifiedSettingsModal';
import LibraryManager from '../LibraryManager';
import OnboardingModal from '../OnboardingModal';
import ToastContainer from '../ui/Toast';
import { ProcessedImage } from '../../types';
import { useSessionStore } from '../../store';

export interface SettingsModalsHostState {
  settings: boolean;
  settingsTab?: 'geral' | 'ichigo' | 'torii' | 'apis' | 'fontes';
  library: boolean;
  onboarding: boolean;
}

export interface SettingsModalsHostHandlers {
  closeSettings: () => void;
  closeLibrary: () => void;
  closeOnboarding: () => void;
  /** Replace the current session with a chapter loaded from the library. */
  onLoadFromLibrary: (images: ProcessedImage[]) => void;
}

interface SettingsModalsHostProps {
  show: SettingsModalsHostState;
  handlers: SettingsModalsHostHandlers;
}

/**
 * Renders every floating UI surface that lives at the application root:
 * unified settings modal, the library manager, the toast container and the
 * onboarding modal.
 *
 * Visibility state remains owned by `App.tsx`.
 */
const SettingsModalsHost: React.FC<SettingsModalsHostProps> = ({ show, handlers }) => {
  const history = useSessionStore(s => s.history);

  return (
    <>
      <UnifiedSettingsModal
        isOpen={show.settings}
        onClose={handlers.closeSettings}
        initialTab={show.settingsTab}
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
