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
import {
  WrenchScrewdriverIcon,
  XMarkIcon,
  BookOpenIcon,
  Cog8ToothIcon,
  QuestionMarkCircleIcon,
  ChevronRightIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

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
  const [mobileLeftTab, setMobileLeftTab] = useState<'pages' | 'controls'>('pages');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'single' | 'strip'>('single');
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  // Settings / utility modals. Visibility lives here because the pipeline's
  // `onAuthError` callback needs to flip the flags too.
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'geral' | 'ichigo' | 'torii' | 'apis' | 'fontes'>('geral');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const modalOpeners: ModalOpeners = {
    ichigo: () => { setSettingsTab('ichigo'); setShowSettings(true); },
    torii: () => { setSettingsTab('torii'); setShowSettings(true); },
    deepl: () => { setSettingsTab('apis'); setShowSettings(true); },
    gemini: () => { setSettingsTab('apis'); setShowSettings(true); },
    openai: () => { setSettingsTab('apis'); setShowSettings(true); },
    fonts: () => { setSettingsTab('fontes'); setShowSettings(true); },
    library: () => setShowLibrary(true),
    settings: () => { setSettingsTab('geral'); setShowSettings(true); },
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
      case 'ichigo': setSettingsTab('ichigo'); setShowSettings(true); break;
      case 'torii': setSettingsTab('torii'); setShowSettings(true); break;
      case 'deepl': setSettingsTab('apis'); setShowSettings(true); break;
      case 'gemini': setSettingsTab('apis'); setShowSettings(true); break;
      case 'openai': setSettingsTab('apis'); setShowSettings(true); break;
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
        { label: 'Configuracoes\u2026', shortcut: 'Ctrl+,', onSelect: () => setShowSettings(true) },
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
        setShowSettings(true);
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
    onOpenRightSidebar: () => setIsRightSidebarOpen(true),
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

      {/* Mobile Sidebar Overlays (drawer backdrops) */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {isMobile && isRightSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsRightSidebarOpen(false)}
        />
      )}

      {isMobile ? (
        // Mobile: keep the original drawer + flex layout. No MenuBar.
        <div className="flex flex-1 min-h-0">
          {/* Left Drawer */}
          <div
            className={`fixed z-50 h-full w-[85vw] bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            {/* Left Drawer Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 shrink-0">
              <button
                onClick={() => setMobileLeftTab('pages')}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all ${
                  mobileLeftTab === 'pages'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Páginas
              </button>
              <button
                onClick={() => setMobileLeftTab('controls')}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all ${
                  mobileLeftTab === 'controls'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Controles
              </button>
            </div>

            {/* Left Drawer Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {mobileLeftTab === 'pages' ? (
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
              ) : (
                <ControlsPanel {...sidebarProps} />
              )}
            </div>
          </div>

          {/* Right Drawer */}
          <div
            className={`fixed right-0 top-0 z-50 h-full w-[85vw] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/20 shrink-0">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <WrenchScrewdriverIcon className="w-5 h-5 text-indigo-400" />
                Painel de Controle
              </h3>
              <button
                onClick={() => setIsRightSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Fechar Menu"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Options */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button
                onClick={() => {
                  setIsRightSidebarOpen(false);
                  modalOpeners.library();
                }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl border border-slate-700/60 hover:border-indigo-500/40 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                    <BookOpenIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">Minha Biblioteca</span>
                    <span className="block text-[11px] text-slate-400">Mangás, capítulos e páginas</span>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  setIsRightSidebarOpen(false);
                  modalOpeners.settings();
                }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl border border-slate-700/60 hover:border-indigo-500/40 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400 group-hover:bg-pink-500/20 transition-colors">
                    <Cog8ToothIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">Configurações</span>
                    <span className="block text-[11px] text-slate-400">Motores de OCR e chaves API</span>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  setIsRightSidebarOpen(false);
                  modalOpeners.onboarding();
                }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl border border-slate-700/60 hover:border-indigo-500/40 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                    <QuestionMarkCircleIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">Tutorial de Ajuda</span>
                    <span className="block text-[11px] text-slate-400">Guia de introdução do tradutor</span>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </button>

              <div className="border-t border-slate-800 pt-4 mt-2 space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Ações Rápidas</h4>
                
                <div className="p-3 bg-slate-800/25 rounded-xl border border-slate-800/60 space-y-3.5">
                  {/* Reading Mode Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Modo de Leitura</span>
                    <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setReadingMode('single')}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                          readingMode === 'single'
                            ? 'bg-slate-800 text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Página
                      </button>
                      <button
                        onClick={() => setReadingMode('strip')}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                          readingMode === 'strip'
                            ? 'bg-slate-800 text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Strip
                      </button>
                    </div>
                  </div>

                  {/* Clean Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Modo Limpo (F11)</span>
                    <button
                      onClick={() => setIsCleanMode(p => !p)}
                      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-all duration-200 focus:outline-none ${
                        isCleanMode ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 bg-white rounded-full shadow-md transform transition-all duration-200" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 mt-2">
                <button
                  onClick={() => {
                    setIsRightSidebarOpen(false);
                    handleClearSession();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-xl border border-red-500/10 hover:border-red-500/20 transition-all font-semibold text-sm"
                >
                  <TrashIcon className="w-5 h-5" />
                  Limpar Sessão Atual
                </button>
              </div>
            </div>
          </div>

          <ViewerArea {...viewerProps} />
        </div>
      ) : (
        // Desktop: MenuBar + resizable 3-panel layout (Navigator | Viewer | Controls).
        <>
          <MenuBar menus={menus} />
          <Group
            orientation="horizontal"
            id="mangalens-shell-v3"
            className="flex flex-1 min-h-0"
          >
            <Panel
              panelRef={navigatorPanelRef}
              id="left"
              defaultSize={16}
              minSize={5}
              collapsible
              collapsedSize={0}
              className="overflow-hidden"
              onResize={(size) => {
                const numSize = typeof size === 'number' ? size : 0;
                if (numSize === 0 && showNavigator) {
                  setShowNavigator(false);
                } else if (numSize > 0 && !showNavigator) {
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
              minSize={5}
              collapsible
              collapsedSize={0}
              className="overflow-hidden"
              onResize={(size) => {
                const numSize = typeof size === 'number' ? size : 0;
                if (numSize === 0 && showControls) {
                  setShowControls(false);
                } else if (numSize > 0 && !showControls) {
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
          settings: showSettings,
          settingsTab,
          library: showLibrary,
          onboarding: showOnboarding,
        }}
        handlers={{
          closeSettings: () => setShowSettings(false),
          closeLibrary: () => setShowLibrary(false),
          closeOnboarding: () => setShowOnboarding(false),
          onLoadFromLibrary: handleLoadFromLibrary,
        }}
      />
    </div>
  );
};

export default App;
