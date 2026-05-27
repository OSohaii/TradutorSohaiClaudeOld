import { useAuthStore, useTranslatorStore } from '../../store';

/**
 * Shared utility: logs out of Ichigo and resets the OCR engine to GEMINI_FLASH
 * if it was set to ICHIGO. Both useTranslatePipeline (on auth error) and
 * IchigoSettingsModal (on manual logout) use this.
 */
export const performIchigoLogout = () => {
  const { logoutIchigo } = useAuthStore.getState();
  const { ocrEngine, setOcrEngine } = useTranslatorStore.getState();
  logoutIchigo();
  if (ocrEngine === 'ICHIGO') setOcrEngine('GEMINI_FLASH');
};
