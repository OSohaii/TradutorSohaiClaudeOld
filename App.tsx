import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from 'react-resizable-panels';

import { ProcessedImage, TextBubble } from './types';
import { DEFAULT_FONT_VALUE } from './components/MangaViewer';

import ControlsPanel from './components/layout/ControlsPanel';
import ViewerArea from './components/layout/ViewerArea';
import Navigator from './components/layout/Navigator';
import DragDropOverlay from './components/layout/DragDropOverlay';
import SettingsModalsHost from './components/layout/SettingsModalsHost';
import MenuBar, { type MenuItem } from './components/layout/MenuBar';
import { useIsMobile } from './components/layout/useIsMobile';
import type { ModalOpeners } from './components/layout/types';

import { useTranslatePipeline } from './features/translator/useTranslatePipeline';
import {
  useFontsStore,
  useLibraryStore,
  useSessionStore,
  useTranslatorStore,
} from './store';

interface MenuDef {
  label: string;
  items: MenuItem[];
}

/**
 * Top-level shell.
 *
 * Responsibilities:
 *  - Owns ephemeral UI state shared across the layout (sidebar visibility,
 *    reading mode, clean mode, modal visibility flags).
 *  - Wires the translation pipeline hook to the rest of the layout.
 *  - Centralises window-level drag&drop and the long-press gesture for
 *    toggling clean mode.
 *  - Picks one of two layout shells at runtime: a `react-resizable-panels`
 *    `Group` on desktop (md+) and a drawer-style flex layout on mobile.
 *  - Owns the desktop `MenuBar` and the global keyboard shortcuts that
 *    drive its actions.
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

  const handleFilesSelect = useCallback(async (files: File[]) => {
    const started = await pipelineFilesSelect(files);
    if (started) setIsSidebarOpen(false);
  }, [pipelineFilesSelect]);

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
  // Layout: desktop vs mobile + the resizable Navigator panel.
  // ------------------------------------------------------------------
  const isMobile = useIsMobile();
  const navigatorPanelRef = useRef<PanelImperativeHandle>(null);
  const [showNavigator, setShowNavigator] = useState(true);

  const controlsPanelRef = useRef<PanelImperativeHandle>(null);
  const [showControls, setShowControls] = useState(true);

  // Sync `showNavigator` (state) -> Panel (imperative). The reverse
  // direction (Panel resize/collapse driven by the user) is wired through
  // the Panel's `onResize` callback below.
  useEffect(() => {
    const panel = navigatorPanelRef.current;
    if (!panel) return;
    if (showNavigator && panel.isCollapsed()) panel.expand();
    else if (!showNavigator && !panel.isCollapsed()) panel.collapse();
  }, [showNavigator]);

  const toggleNavigator = useCallback(() => setShowNavigator(s => !s), []);

  // Sync `showControls` (state) -> Panel (imperative).
  useEffect(() => {
    const panel = controlsPanelRef.current;
    if (!panel) return;
    if (showControls && panel.isCollapsed()) panel.expand();
    else if (!showControls && !panel.isCollapsed()) panel.collapse();
  }, [showControls]);

  const toggleControls = useCallback(() => setShowControls(s => !s), []);

  // ------------------------------------------------------------------
  // File picker wired to the "Arquivo > Abrir arquivos…" menu item and
  // the Ctrl+O shortcut. We use a hidden <input> so the picker UX is
  // identical to the in-page Uploader.
  // ------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) void handleFilesSelect(files);
    // Reset so picking the same file again still triggers a change event.
    e.target.value = '';
  }, [handleFilesSelect]);

  // ------------------------------------------------------------------
  // "Limpar sessão" / Ctrl+Shift+N
  // ------------------------------------------------------------------
  const handleClearSession = useCallback(() => {
    if (window.confirm(
      'Limpar todas as paginas da sessao atual? Isso nao apaga itens da Biblioteca.'
    )) {
      replaceSessionHistory([]);
    }
  }, [replaceSessionHistory]);

  // ------------------------------------------------------------------
  // MenuBar definition
  //
  // Items with `onSelect: undefined` render as visible-but-disabled — we
  // show them so users see what's coming in upcoming PRs (URL load,
  // export, undo/redo, shortcuts overlay, About).
  // ------------------------------------------------------------------
  const menus: MenuDef[] = useMemo(() => [
    {
      label: 'Arquivo',
      items: [
        { label: 'Abrir arquivos\u2026', shortcut: 'Ctrl+O', onSelect: triggerFilePicker },
        { label: 'Carregar URL\u2026', shortcut: 'Ctrl+U', onSelect: undefined },
        { label: 'Exportar pagina\u2026', shortcut: 'Ctrl+E', onSelect: undefined },
        { type: 'separator' },
        { label: 'Limpar sessao', shortcut: 'Ctrl+Shift+N', onSelect: handleClearSession },
      ],
    },
    {
      label: 'Editar',
      items: [
        { label: 'Desfazer', shortcut: 'Ctrl+Z', onSelect: undefined },
        { label: 'Refazer', shortcut: 'Ctrl+Shift+Z', onSelect: undefined },
        { type: 'separator' },
        { label: 'Configuracoes\u2026', shortcut: 'Ctrl+,', onSelect: () => setShowSettingsPanel(true) },
      ],
    },
    {
      label: 'Ver',
      items: [
        { label: 'Mostrar Navigator', shortcut: 'Ctrl+B', onSelect: toggleNavigator, checked: showNavigator },
        { label: 'Mostrar Controles', shortcut: 'Ctrl+J', onSelect: toggleControls, checked: showControls },
        { label: 'Modo limpo', shortcut: 'F11', onSelect: () => setIsCleanMode(p => !p), checked: isCleanMode },
        { type: 'separator' },
        { label: 'Atalhos de teclado', shortcut: '?', onSelect: undefined },
      ],
    },
    {
      label: 'Traduzir',
      items: [
        { label: 'Traduzir todas pendentes', shortcut: 'Ctrl+Shift+T', onSelect: () => void handleTranslateAll() },
        { type: 'separator' },
        { label: 'Modo Pagina unica', onSelect: () => setReadingMode('single'), checked: readingMode === 'single' },
        { label: 'Modo Strip continuo', onSelect: () => setReadingMode('strip'), checked: readingMode === 'strip' },
      ],
    },
    {
      label: 'Ajuda',
      items: [
        { label: 'Tutorial', onSelect: () => {
          localStorage.removeItem('mangalens-onboarding-done');
          setShowOnboarding(true);
        } },
        { type: 'separator' },
        { label: 'Sobre o MangaLens', onSelect: undefined },
      ],
    },
  ], [
    showNavigator,
    showControls,
    isCleanMode,
    readingMode,
    triggerFilePicker,
    handleClearSession,
    toggleNavigator,
    toggleControls,
    handleTranslateAll,
  ]);

  // ------------------------------------------------------------------
  // Global keyboard shortcuts. They mirror the menu and work even when
  // the menu isn't open. We bail out when focus is on an editable element
  // so typing in inputs / contenteditable bubbles isn't hijacked.
  // ------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )) {
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        setShowSettingsPanel(true);
      } else if (ctrl && !e.shiftKey && key === 'b') {
        e.preventDefault();
        toggleNavigator();
      } else if (ctrl && !e.shiftKey && key === 'j') {
        e.preventDefault();
        toggleControls();
      } else if (ctrl && !e.shiftKey && key === 'o') {
        e.preventDefault();
        triggerFilePicker();
      } else if (ctrl && e.shiftKey && key === 't') {
        e.preventDefault();
        void handleTranslateAll();
      } else if (ctrl && e.shiftKey && key === 'n') {
        e.preventDefault();
        handleClearSession();
      } else if (e.key === 'F11') {
        e.preventDefault();
        setIsCleanMode(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    toggleNavigator,
    toggleControls,
    triggerFilePicker,
    handleTranslateAll,
    handleClearSession,
  ]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const sidebarProps = {
    handleTranslateAll,
    handleTranslateImage,
    handleTranslateOnly,
    handleCancelOcr,
    retryImage,
    totalCost,
    displayedTotalTokens,
    modalOpeners,
  };

  const viewerProps = {
    onOpenSidebar: () => setIsSidebarOpen(true),
    readingMode,
    setReadingMode,
    isCleanMode,
    setIsCleanMode,
    longPressTriggered,
    handleFilesSelect,
    handleTranslateOnly,
    handleCancelOcr,
    retryImage,
    onBubbleUpdate: handleBubbleUpdate,
    onBubbleDelete: handleBubbleDelete,
    onBubbleAdd: handleBubbleAdd,
    onImageUpdate: handleImageUpdate,
    onStripBubbleUpdate: handleStripBubbleUpdate,
  };

  return (
    <div
      className="flex h-screen flex-col bg-slate-950 text-slate-100 overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input wired to the "Abrir arquivos…" menu item / Ctrl+O */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Global Drag & Drop Overlay */}
      {isDragOverWindow && <DragDropOverlay />}

      {/* Mobile Sidebar Overlay (drawer backdrop) */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {isMobile ? (
        // Mobile: keep the original drawer + flex layout. No MenuBar.
        <div className="flex flex-1 min-h-0">
          <div
            className={`fixed z-50 h-full w-[85vw] bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out overflow-y-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <Navigator
              handleTranslateAll={handleTranslateAll}
              handleTranslateImage={handleTranslateImage}
              handleTranslateOnly={handleTranslateOnly}
              handleCancelOcr={handleCancelOcr}
              retryImage={retryImage}
              totalCost={totalCost}
              displayedTotalTokens={displayedTotalTokens}
              onPagePicked={() => setIsSidebarOpen(false)}
            />
            <ControlsPanel {...sidebarProps} />
          </div>
          <ViewerArea {...viewerProps} />
        </div>
      ) : (
        // Desktop: MenuBar + resizable 3-panel layout (Navigator | Viewer | Controls).
        <>
          <MenuBar menus={menus} />
          <Group
            orientation="horizontal"
            id="mangalens-shell-v2"
            className="flex flex-1 min-h-0"
          >
            <Panel
              panelRef={navigatorPanelRef}
              id="left"
              defaultSize={16}
              minSize={12}
              maxSize={28}
              collapsible
              collapsedSize={0}
              onResize={(size) => {
                if (size.asPercentage === 0 && showNavigator) {
                  setShowNavigator(false);
                } else if (size.asPercentage > 0 && !showNavigator) {
                  setShowNavigator(true);
                }
              }}
            >
              <Navigator
                handleTranslateAll={handleTranslateAll}
                handleTranslateImage={handleTranslateImage}
                handleTranslateOnly={handleTranslateOnly}
                handleCancelOcr={handleCancelOcr}
                retryImage={retryImage}
                totalCost={totalCost}
                displayedTotalTokens={displayedTotalTokens}
              />
            </Panel>
            <Separator className="w-px bg-slate-800 transition-colors data-[hover]:bg-indigo-500 hover:bg-indigo-500" />
            <Panel id="center" minSize={35}>
              <ViewerArea {...viewerProps} />
            </Panel>
            <Separator className="w-px bg-slate-800 transition-colors data-[hover]:bg-indigo-500 hover:bg-indigo-500" />
            <Panel
              panelRef={controlsPanelRef}
              id="right"
              defaultSize={24}
              minSize={18}
              maxSize={38}
              collapsible
              collapsedSize={0}
              onResize={(size) => {
                if (size.asPercentage === 0 && showControls) {
                  setShowControls(false);
                } else if (size.asPercentage > 0 && !showControls) {
                  setShowControls(true);
                }
              }}
            >
              <ControlsPanel {...sidebarProps} />
            </Panel>
          </Group>
        </>
      )}

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
