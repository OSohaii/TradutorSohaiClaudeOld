import { useAuthStore, useTranslatorStore, useSessionStore } from '../../store';
import { useTokenTracker } from './useTokenTracker';
import { planPipeline } from './planPipeline';
import { performIchigoLogout } from './ichigoLogout';
import {
  ApiError,
  ByokKeys,
  runPipeline as runPipelineApi,
} from '../../services/api/pipelineApi';
import { createTrackedObjectURL } from '../../services/blobUrls';
import { ProcessedImage, TextBubble } from '../../types';

/**
 * Pure utility: reads a File as a base64 data URL string.
 * Exported so FontManagerModal (and any other consumer) can reuse it.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const encoded = reader.result as string;
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });
};

export interface UseTranslatePipelineOptions {
  onAuthError: (modal: 'ichigo' | 'torii' | 'deepl' | 'gemini' | 'openai') => void;
}

export interface UseTranslatePipelineReturn {
  handleFilesSelect: (files: File[]) => Promise<boolean>;
  handleRetranslate: () => Promise<void>;
  handleTranslateImage: (imageId: string) => Promise<void>;
  handleTranslateAll: () => Promise<void>;
  handleOcrOnly: (imageId: string) => Promise<void>;
  handleTranslateOnly: (imageId: string) => Promise<void>;
  handleCancelOcr: (imageId: string) => void;
  retryImage: (imageId: string) => Promise<void>;
  totalCost: number;
  displayedTotalTokens: number;
}

export const useTranslatePipeline = (
  options: UseTranslatePipelineOptions,
): UseTranslatePipelineReturn => {
  const { onAuthError } = options;

  // Store selectors
  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const transEngine = useTranslatorStore(s => s.transEngine);
  const ichigoModel = useTranslatorStore(s => s.ichigoModel);
  const useToriiForCleaning = useTranslatorStore(s => s.useToriiForCleaning);
  const autoTranslate = useTranslatorStore(s => s.autoTranslate);
  const sourceLanguage = useTranslatorStore(s => s.sourceLanguage);
  const targetLanguage = useTranslatorStore(s => s.targetLanguage);
  const targetLangCode = useTranslatorStore(s => s.targetLangCode);

  const ichigoToken = useAuthStore(s => s.ichigoToken);
  const toriiApiKey = useAuthStore(s => s.toriiApiKey);
  const deepLKey = useAuthStore(s => s.deepLKey);
  const geminiApiKey = useAuthStore(s => s.geminiApiKey);
  const openaiApiKey = useAuthStore(s => s.openaiApiKey);

  const currentImage = useSessionStore(s => s.currentImage);
  const addImagesToSession = useSessionStore(s => s.addImages);
  const updateImageStateInStore = useSessionStore(s => s.updateImageState);

  const { totalCost, displayedTotalTokens, handleTokenUsage } = useTokenTracker();

  // --- Internal helpers ---

  const base64ToObjectUrl = (b64: string, mime = 'image/png'): string => {
    const byteString = atob(b64);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return createTrackedObjectURL(blob);
  };

  const buildByok = (): ByokKeys => ({
    gemini: geminiApiKey || undefined,
    deepl: deepLKey || undefined,
    torii: toriiApiKey || undefined,
    ichigo: ichigoToken || undefined,
    openai: openaiApiKey || undefined,
  });

  const runPipeline = async (
    base64: string,
  ): Promise<{ bubbles: TextBubble[]; translatedImageUrl?: string }> => {
    const usingTorii = ocrEngine === 'TORII' || transEngine === 'TORII';
    const wantsCleaner = useToriiForCleaning && !usingTorii;

    const plan = planPipeline(ocrEngine, transEngine, { useToriiForCleaning: wantsCleaner });
    // Plan is used for debugging; future UI will display it.
    console.debug('[pipeline] plan:', plan);

    let response;
    try {
      response = await runPipelineApi(
        {
          imageBase64: base64,
          ocr: { engine: ocrEngine },
          translation: { engine: transEngine },
          cleaner: { enabled: wantsCleaner, engine: 'TORII' },
          options: {
            targetLanguage,
            targetLangCode,
            ichigoModel,
            sourceLanguage,
          },
        },
        buildByok(),
      );
    } catch (err) {
      // If the cleaner caused the failure, retry without it
      if (wantsCleaner && err instanceof ApiError && err.engine === 'torii') {
        console.warn('[pipeline] cleaner failed, retrying without:', err.message);
        response = await runPipelineApi(
          {
            imageBase64: base64,
            ocr: { engine: ocrEngine },
            translation: { engine: transEngine },
            cleaner: { enabled: false },
            options: {
              targetLanguage,
              targetLangCode,
              ichigoModel,
              sourceLanguage,
            },
          },
          buildByok(),
        );
        response.warnings = [...(response.warnings || []), `Cleaner falhou: ${(err as ApiError).message}`];
      } else {
        throw err;
      }
    }

    if (response.tokens) handleTokenUsage(response.tokens);
    if (response.warnings && response.warnings.length > 0) {
      response.warnings.forEach(w => console.warn('[pipeline]', w));
    }

    let translatedImageUrl: string | undefined;
    if (response.translatedImageBase64) {
      translatedImageUrl = base64ToObjectUrl(response.translatedImageBase64);
    } else if (response.cleanedImageBase64) {
      translatedImageUrl = base64ToObjectUrl(response.cleanedImageBase64);
    }

    return { bubbles: response.bubbles, translatedImageUrl };
  };

  const runPipelineOcrOnly = async (
    base64: string,
  ): Promise<{ bubbles: TextBubble[] }> => {
    const response = await runPipelineApi(
      {
        imageBase64: base64,
        ocr: { engine: ocrEngine },
        translation: { engine: transEngine },
        cleaner: { enabled: false },
        options: {
          targetLanguage,
          targetLangCode,
          ichigoModel,
          sourceLanguage,
        },
        phase: 'ocr-only',
      },
      buildByok(),
    );

    if (response.tokens) handleTokenUsage(response.tokens);
    return { bubbles: response.bubbles };
  };

  const runPipelineTranslateOnly = async (
    bubbles: TextBubble[],
  ): Promise<{ bubbles: TextBubble[] }> => {
    const response = await runPipelineApi(
      {
        imageBase64: 'AAAA', // Placeholder - backend does not use image data for translate-only
        ocr: { engine: ocrEngine },
        translation: { engine: transEngine },
        cleaner: { enabled: false },
        options: {
          targetLanguage,
          targetLangCode,
          ichigoModel,
          sourceLanguage,
        },
        phase: 'translate-only',
        bubbles,
      },
      buildByok(),
    );

    if (response.tokens) handleTokenUsage(response.tokens);
    return { bubbles: response.bubbles };
  };

  const handlePipelineError = (error: unknown): { errorMsg: string } => {
    if (error instanceof ApiError) {
      if (error.code === 'AUTH' || error.code === 'INVALID_KEY') {
        switch (error.engine) {
          case 'ichigo':
            if (error.code === 'AUTH') performIchigoLogout();
            onAuthError('ichigo');
            break;
          case 'gemini':
            onAuthError('gemini');
            break;
          case 'deepl':
            onAuthError('deepl');
            break;
          case 'torii':
            onAuthError('torii');
            break;
          case 'openai':
            onAuthError('openai');
            break;
        }
      }

      const msgByCode: Partial<Record<typeof error.code, string>> = {
        RATE_LIMIT: 'Limite de uso atingido. Tente novamente em instantes.',
        QUOTA: 'Cota do provedor atingida.',
        AUTH: 'Erro de autenticacao.',
        INVALID_KEY: 'Chave de API necessaria ou invalida.',
        NETWORK: 'Falha de rede.',
      };
      return { errorMsg: msgByCode[error.code] ?? error.message };
    }

    return { errorMsg: error instanceof Error ? error.message : 'Falha na traducao.' };
  };

  const processImage = async (imageObj: ProcessedImage, file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;

      const { bubbles, translatedImageUrl } = await runPipeline(base64Clean);

      updateImageStateInStore(imageObj.id, {
        base64: base64Clean,
        bubbles,
        translatedImageUrl,
        status: 'done',
      });
    } catch (error: unknown) {
      console.error(`Error processing ${imageObj.fileName}:`, error);
      const { errorMsg } = handlePipelineError(error);
      updateImageStateInStore(imageObj.id, { status: 'error', errorMessage: errorMsg });
    }
  };

  const handleRetranslate = async () => {
    if (!currentImage) return;
    const imageId = currentImage.id;
    updateImageStateInStore(imageId, {
      status: 'processing',
      bubbles: [],
      translatedImageUrl: undefined,
      maskDataUrl: undefined,
    });

    try {
      let base64Clean = currentImage.base64;
      if (!base64Clean) {
        const res = await fetch(currentImage.imageUrl);
        const blob = await res.blob();
        const file = new File([blob], currentImage.fileName, { type: blob.type });
        const dataUrl = await fileToBase64(file);
        base64Clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        updateImageStateInStore(imageId, { base64: base64Clean });
      }

      const { bubbles, translatedImageUrl } = await runPipeline(base64Clean);
      updateImageStateInStore(imageId, {
        status: 'done',
        bubbles,
        translatedImageUrl,
      });
    } catch (error: unknown) {
      const { errorMsg } = handlePipelineError(error);
      updateImageStateInStore(imageId, { status: 'error', errorMessage: errorMsg });
    }
  };

  /**
   * Returns `true` when processing was initiated, `false` when blocked by
   * missing credentials (an auth modal was opened instead).
   */
  const handleFilesSelect = async (files: File[]): Promise<boolean> => {
    if (files.length === 0) return false;
    if ((ocrEngine === 'ICHIGO') && !ichigoToken) { onAuthError('ichigo'); return false; }
    if ((transEngine === 'TORII' || ocrEngine === 'TORII' || useToriiForCleaning) && !toriiApiKey) { onAuthError('torii'); return false; }
    if (transEngine === 'DEEPL' && !deepLKey) { onAuthError('deepl'); return false; }
    if ((ocrEngine === 'GPT4O' || ocrEngine === 'GPT4O_MINI' || transEngine === 'GPT4O' || transEngine === 'GPT4O_MINI') && !openaiApiKey) { onAuthError('openai'); return false; }

    // Request notification permission on first batch start
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const newImages: ProcessedImage[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      fileName: file.name,
      imageUrl: createTrackedObjectURL(file),
      base64: '',
      bubbles: [],
      status: autoTranslate ? 'processing' : 'idle',
    }));

    addImagesToSession(newImages);

    if (autoTranslate) {
      // Parallel batch: process up to 3 images concurrently
      const CONCURRENCY = 3;
      for (let i = 0; i < newImages.length; i += CONCURRENCY) {
        const chunk = newImages.slice(i, i + CONCURRENCY);
        const chunkFiles = files.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map((img, idx) => processImage(img, chunkFiles[idx]))
        );
      }

      // Browser notification on batch completion
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification('Traducao Concluida!', { body: `${files.length} pagina(s) processada(s).` });
      }
    }
    return true;
  };

  const checkCredentials = (): boolean => {
    if ((ocrEngine === 'ICHIGO') && !ichigoToken) { onAuthError('ichigo'); return false; }
    if ((transEngine === 'TORII' || ocrEngine === 'TORII' || useToriiForCleaning) && !toriiApiKey) { onAuthError('torii'); return false; }
    if (transEngine === 'DEEPL' && !deepLKey) { onAuthError('deepl'); return false; }
    if ((ocrEngine === 'GPT4O' || ocrEngine === 'GPT4O_MINI' || transEngine === 'GPT4O' || transEngine === 'GPT4O_MINI') && !openaiApiKey) { onAuthError('openai'); return false; }
    return true;
  };

  const handleTranslateImage = async (imageId: string): Promise<void> => {
    if (!checkCredentials()) return;
    const history = useSessionStore.getState().history;
    const img = history.find(h => h.id === imageId);
    if (!img || (img.status !== 'idle' && img.status !== 'ocr-done')) return;

    if (!autoTranslate) {
      // Delegate to handleOcrOnly when auto-translate is OFF
      await handleOcrOnly(imageId);
      return;
    }

    updateImageStateInStore(imageId, { status: 'processing' });

    try {
      const res = await fetch(img.imageUrl);
      const blob = await res.blob();
      const file = new File([blob], img.fileName, { type: blob.type });
      const base64 = await fileToBase64(file);
      const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;

      const { bubbles, translatedImageUrl } = await runPipeline(base64Clean);
      updateImageStateInStore(imageId, { base64: base64Clean, bubbles, translatedImageUrl, status: 'done' });
    } catch (error: unknown) {
      console.error(`Error translating ${img.fileName}:`, error);
      const { errorMsg } = handlePipelineError(error);
      updateImageStateInStore(imageId, { status: 'error', errorMessage: errorMsg });
    }
  };

  const handleOcrOnly = async (imageId: string): Promise<void> => {
    if (!checkCredentials()) return;
    const history = useSessionStore.getState().history;
    const img = history.find(h => h.id === imageId);
    if (!img || img.status !== 'idle') return;

    updateImageStateInStore(imageId, { status: 'processing' });

    try {
      const res = await fetch(img.imageUrl);
      const blob = await res.blob();
      const file = new File([blob], img.fileName, { type: blob.type });
      const base64 = await fileToBase64(file);
      const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;
      const { bubbles } = await runPipelineOcrOnly(base64Clean);
      updateImageStateInStore(imageId, { base64: base64Clean, bubbles, status: 'ocr-done' });
    } catch (error: unknown) {
      console.error(`Error OCR ${img.fileName}:`, error);
      const { errorMsg } = handlePipelineError(error);
      updateImageStateInStore(imageId, { status: 'error', errorMessage: errorMsg });
    }
  };

  const handleTranslateOnly = async (imageId: string): Promise<void> => {
    if (!checkCredentials()) return;
    const history = useSessionStore.getState().history;
    const img = history.find(h => h.id === imageId);
    if (!img || img.status !== 'ocr-done') return;

    updateImageStateInStore(imageId, { status: 'processing' });

    try {
      const { bubbles } = await runPipelineTranslateOnly(img.bubbles);
      updateImageStateInStore(imageId, { bubbles, status: 'done' });
    } catch (error: unknown) {
      console.error(`Error translating ${img.fileName}:`, error);
      const { errorMsg } = handlePipelineError(error);
      updateImageStateInStore(imageId, { status: 'error', errorMessage: errorMsg });
    }
  };

  const handleCancelOcr = (imageId: string): void => {
    updateImageStateInStore(imageId, { bubbles: [], status: 'idle' });
  };

  const handleTranslateAll = async (): Promise<void> => {
    if (!checkCredentials()) return;

    // Snapshot the IDs of images to process at the time the user clicked
    // "Translate All". The set is FROZEN here:
    // - Newly uploaded pages during the batch are NOT silently picked up
    //   (the user can run the action again).
    // - Pages that change state during the batch (e.g. user manually
    //   triggers OCR on one) are skipped on the per-chunk re-check below.
    //
    // Previously this captured the ProcessedImage objects directly and
    // never re-checked their status, leading to wasted work (calling
    // handleTranslateImage on a page the user had already processed) and
    // confusing behavior when the user removed a page mid-batch.
    const initialHistory = useSessionStore.getState().history;
    const idleIds = initialHistory.filter(h => h.status === 'idle').map(h => h.id);
    const ocrDoneIds = initialHistory.filter(h => h.status === 'ocr-done').map(h => h.id);

    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const totalCount = idleIds.length + ocrDoneIds.length;

    // Parallel batch: process up to 3 images concurrently
    const CONCURRENCY = 3;

    // Re-fetch the current snapshot of an image right before dispatching it,
    // so we don't kick off a translate request on a page that was removed
    // or whose state moved out from under us.
    const stillIdle = (id: string): boolean => {
      const img = useSessionStore.getState().history.find(h => h.id === id);
      return img?.status === 'idle';
    };
    const stillOcrDone = (id: string): boolean => {
      const img = useSessionStore.getState().history.find(h => h.id === id);
      return img?.status === 'ocr-done';
    };

    // Process idle images through handleTranslateImage (full or ocr-only depending on autoTranslate)
    for (let i = 0; i < idleIds.length; i += CONCURRENCY) {
      const chunk = idleIds.slice(i, i + CONCURRENCY).filter(stillIdle);
      if (chunk.length === 0) continue;
      await Promise.all(chunk.map(id => handleTranslateImage(id)));
    }

    // Process ocr-done images through handleTranslateOnly
    for (let i = 0; i < ocrDoneIds.length; i += CONCURRENCY) {
      const chunk = ocrDoneIds.slice(i, i + CONCURRENCY).filter(stillOcrDone);
      if (chunk.length === 0) continue;
      await Promise.all(chunk.map(id => handleTranslateOnly(id)));
    }

    // Browser notification on batch completion
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification('Traducao Concluida!', { body: `${totalCount} pagina(s) processada(s).` });
    }
  };

  const retryImage = async (imageId: string): Promise<void> => {
    if (!checkCredentials()) return;
    const history = useSessionStore.getState().history;
    const img = history.find(h => h.id === imageId);
    if (!img || img.status !== 'error') return;

    updateImageStateInStore(imageId, {
      status: 'processing',
      bubbles: [],
      translatedImageUrl: undefined,
      maskDataUrl: undefined,
    });

    try {
      let base64Clean = img.base64;
      if (!base64Clean) {
        const res = await fetch(img.imageUrl);
        const blob = await res.blob();
        const file = new File([blob], img.fileName, { type: blob.type });
        const dataUrl = await fileToBase64(file);
        base64Clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      }
      const { bubbles, translatedImageUrl } = await runPipeline(base64Clean);
      updateImageStateInStore(imageId, { base64: base64Clean, bubbles, translatedImageUrl, status: 'done' });
    } catch (error: unknown) {
      console.error(`Error retrying ${img.fileName}:`, error);
      const { errorMsg } = handlePipelineError(error);
      updateImageStateInStore(imageId, { status: 'error', errorMessage: errorMsg });
    }
  };

  return { handleFilesSelect, handleRetranslate, handleTranslateImage, handleTranslateAll, handleOcrOnly, handleTranslateOnly, handleCancelOcr, retryImage, totalCost, displayedTotalTokens };
};
