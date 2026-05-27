import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ProcessedImage, TextBubble } from './types';
import { DEFAULT_FONT_VALUE } from './components/MangaViewer';

import Sidebar from './components/layout/Sidebar';
import ViewerArea from './components/layout/ViewerArea';
import DragDropOverlay from './components/layout/DragDropOverlay';
import SettingsModalsHost from './components/layout/SettingsModalsHost';
import type { ModalOpeners } from './components/layout/types';

import { useTranslatePipeline } from './features/translator/useTranslatePipeline';
import {
  useFontsStore,
  useLibraryStore,
  useSessionStore,
  useTranslatorStore,
} from './store';

/**
 * Top-level shell.
 *
 * Responsibilities:
 *  - Owns ephemeral UI state shared across the layout (sidebar visibility,
 *    reading mode, clean mode, modal visibility flags).
 *  - Wires the translation pipeline hook to the rest of the layout.
 *  - Centralises window-level drag&drop and the long-press gesture for
 *    toggling clean mode.
 *  - Delegates rendering to four focused layout components: Sidebar,
 *    ViewerArea, DragDropOverlay, SettingsModalsHost.
 *
 * Most domain state (history, translator preferences, fonts, auth keys) is
 * stored in zustand and read by the leaf components directly, so this shell
 * stays thin.
 */
const App: React.FC = () => {
  // ------------------------------------------------------------------
  // Session / global stores accessed at the orchestration layer
  // ------------------------------------------------------------------
  const replaceSessionHistory = useSessionStore(s => s.replaceHistory);
  const updateImageStateInStore = useSessionStore(s => s.updateImageState);
  const updateBubbleInStore = useSessionStore(s => s.updateBubble);
  const updateBubbleForImage = useSessionStore(s => s.updateBubbleForImage);
  const pushBubbleSnapshotForImage = useSessionStore(s => s.pushBubbleSnapshotForImage);
  const removeBubbleInStore = useSessionStore(s => s.removeBubble);
  const addBubbleInStore = useSessionStore(s => s.addBubble);

  const targetFont = useTranslatorStore(s => s.targetFont);
  const setTargetFont = useTranslatorStore(s => s.setTargetFont);

  const registerLoadedFonts = useFontsStore(s => s.registerLoadedFonts);
  const runLegacyImagesMigration = useLibraryStore(s => s.runLegacyImagesMigration);

  // Seed the font default on first run.
  useEffect(() => {
    if (!targetFont) setTargetFont(DEFAULT_FONT_VALUE);
  }, [targetFont, setTargetFont]);

  useEffect(() => {
    void registerLoadedFonts();
  }, [registerLoadedFonts]);

  useEffect(() => {
    void runLegacyImagesMigration();
  }, [runLegacyImagesMigration]);

  // ------------------------------------------------------------------
  // UI state (sidebar, viewer mode, modals)
  // ------------------------------------------------------------------
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'single' | 'strip'>('single');
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  // Settings / utility modals. Visibility lives here because the pipeline's
  // `onAuthError` callback needs to flip the flags too.
  const [showIchigoSettings, setShowIchigoSettings] = useState(false);
  const [showToriiSettings, setShowToriiSettings] = useState(false);
  const [showDeepLSettings, setShowDeepLSettings] = useState(false);
  const [showGeminiSettings, setShowGeminiSettings] = useState(false);
  const [showOpenAISettings, setShowOpenAISettings] = useState(false);
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const modalOpeners: ModalOpeners = {
    ichigo: () => setShowIchigoSettings(true),
    torii: () => setShowToriiSettings(true),
    deepl: () => setShowDeepLSettings(true),
    gemini: () => setShowGeminiSettings(true),
    openai: () => setShowOpenAISettings(true),
    fonts: () => setShowFontSettings(true),
    library: () => setShowLibrary(true),
    settings: () => setShowSettingsPanel(true),
    onboarding: () => {
      // Reset the onboarding-done flag so the modal re-runs the full tour.
      localStorage.removeItem('mangalens-onboarding-done');
      setShowOnboarding(true);
    },
  };

  // ------------------------------------------------------------------
  // Translation pipeline
  // ------------------------------------------------------------------
  const onAuthError = useCallback((modal: 'ichigo' | 'torii' | 'deepl' | 'gemini' | 'openai') => {
    switch (modal) {
      case 'ichigo': setShowIchigoSettings(true); break;
      case 'torii': setShowToriiSettings(true); break;
      case 'deepl': setShowDeepLSettings(true); break;
      case 'gemini': setShowGeminiSettings(true); break;
      case 'openai': setShowOpenAISettings(true); break;
    }
  }, []);

  const {
    handleFilesSelect: pipelineFilesSelect,
    handleTranslateImage,
    handleTranslateAll,
    handleTranslateOnly,
    handleCancelOcr,
    retryImage,
    totalCost,
    displayedTotalTokens,
  } = useTranslatePipeline({ onAuthError });

  const handleFilesSelect = async (files: File[]) => {
    const started = await pipelineFilesSelect(files);
    if (started) setIsSidebarOpen(false);
  };

  // ------------------------------------------------------------------
  // Long-press gesture: toggle clean mode after a 600ms hold (mobile).
  // ------------------------------------------------------------------
  const timerRef = useRef<number | null>(null);

  const handleTouchStart = () => {
    timerRef.current = window.setTimeout(() => {
      setIsCleanMode(prev => !prev);
      setLongPressTriggered(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Reset trigger flag after a short delay so click events don't fire
    // immediately if it was a long press.
    setTimeout(() => setLongPressTriggered(false), 100);
  };

  // ------------------------------------------------------------------
  // Window-level drag & drop
  // ------------------------------------------------------------------
  const [isDragOverWindow, setIsDragOverWindow] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounter.current++;
      setIsDragOverWindow(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOverWindow(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOverWindow(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesSelect(Array.from(e.dataTransfer.files));
    }
  };

  // ------------------------------------------------------------------
  // Bubble / image handlers passed down to ViewerArea (single page mode).
  // Thin wrappers around the session store actions.
  // ------------------------------------------------------------------
  const handleBubbleUpdate = (bubble: TextBubble) => updateBubbleInStore(bubble);
  const handleBubbleDelete = (bubbleId: string) => removeBubbleInStore(bubbleId);
  const handleBubbleAdd = (bubble: TextBubble) => addBubbleInStore(bubble);
  const handleImageUpdate = (img: ProcessedImage) => updateImageStateInStore(img.id, img);

  /** Strip-mode bubble update: snapshot first, then apply. */
  const handleStripBubbleUpdate = (imageId: string, bubble: TextBubble) => {
    pushBubbleSnapshotForImage(imageId);
    updateBubbleForImage(imageId, bubble);
  };

  /** Replace the current session with a chapter loaded from the library. */
  const handleLoadFromLibrary = (images: ProcessedImage[]) => {
    replaceSessionHistory(images);
    setIsSidebarOpen(false);
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Global Drag & Drop Overlay */}
      {isDragOverWindow && <DragDropOverlay />}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (drawer on mobile, fixed column on desktop) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        handleTranslateAll={handleTranslateAll}
        handleTranslateImage={handleTranslateImage}
        handleTranslateOnly={handleTranslateOnly}
        handleCancelOcr={handleCancelOcr}
        retryImage={retryImage}
        totalCost={totalCost}
        displayedTotalTokens={displayedTotalTokens}
        modalOpeners={modalOpeners}
      />

      {/* Main viewer area */}
      <ViewerArea
        onOpenSidebar={() => setIsSidebarOpen(true)}
        readingMode={readingMode}
        setReadingMode={setReadingMode}
        isCleanMode={isCleanMode}
        setIsCleanMode={setIsCleanMode}
        longPressTriggered={longPressTriggered}
        handleFilesSelect={handleFilesSelect}
        handleTranslateOnly={handleTranslateOnly}
        handleCancelOcr={handleCancelOcr}
        retryImage={retryImage}
        onBubbleUpdate={handleBubbleUpdate}
        onBubbleDelete={handleBubbleDelete}
        onBubbleAdd={handleBubbleAdd}
        onImageUpdate={handleImageUpdate}
        onStripBubbleUpdate={handleStripBubbleUpdate}
      />

      {/* Modals + Library + Toast + Onboarding */}
      <SettingsModalsHost
        show={{
          ichigo: showIchigoSettings,
          torii: showToriiSettings,
          deepl: showDeepLSettings,
          gemini: showGeminiSettings,
          openai: showOpenAISettings,
          fonts: showFontSettings,
          settings: showSettingsPanel,
          library: showLibrary,
          onboarding: showOnboarding,
        }}
        handlers={{
          closeIchigo: () => setShowIchigoSettings(false),
          closeTorii: () => setShowToriiSettings(false),
          closeDeepL: () => setShowDeepLSettings(false),
          closeGemini: () => setShowGeminiSettings(false),
          closeOpenAI: () => setShowOpenAISettings(false),
          closeFonts: () => setShowFontSettings(false),
          closeSettings: () => setShowSettingsPanel(false),
          closeLibrary: () => setShowLibrary(false),
          closeOnboarding: () => setShowOnboarding(false),
          openIchigoFromSettings: () => setShowIchigoSettings(true),
          onLoadFromLibrary: handleLoadFromLibrary,
        }}
      />
    </div>
  );
};

export default App;
