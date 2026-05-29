import React, { useState } from 'react';
import { ArrowsPointingInIcon } from '@heroicons/react/24/outline';

import MangaViewer from '../MangaViewer';
import Uploader from '../Uploader';
import BatchProgressBar from '../ui/BatchProgressBar';
import TopBar from './TopBar';

import { useFontsStore, useSessionStore, useTranslatorStore, EngineId } from '../../store';
import { estimateCost } from '../../features/translator/costEstimation';
import { ProcessedImage, TextBubble } from '../../types';

interface ViewerAreaProps {
  /** Open the sidebar drawer (mobile only). */
  onOpenSidebar: () => void;
  onOpenRightSidebar: () => void;

  /** Reading mode (single page vs long strip). */
  readingMode: 'single' | 'strip';
  setReadingMode: React.Dispatch<React.SetStateAction<'single' | 'strip'>>;

  /** "Clean mode" hides chrome to maximise the viewer area. */
  isCleanMode: boolean;
  setIsCleanMode: React.Dispatch<React.SetStateAction<boolean>>;

  /** Used to suppress the long-press hint after the gesture has already fired. */
  longPressTriggered: boolean;

  // Pipeline handlers (owned by App via useTranslatePipeline)
  handleFilesSelect: (files: File[]) => Promise<void> | void;
  handleTranslateOnly: (id: string) => Promise<void> | void;
  handleCancelOcr: (id: string) => void;
  retryImage: (id: string) => Promise<void> | void;

  // Bubble / image handlers (single page mode)
  onBubbleUpdate: (bubble: TextBubble) => void;
  onBubbleDelete: (bubbleId: string) => void;
  onBubbleAdd: (bubble: TextBubble) => void;
  onImageUpdate: (image: ProcessedImage) => void;

  // Strip-mode bubble update wrapper (snapshot + update for a specific image).
  onStripBubbleUpdate: (imageId: string, bubble: TextBubble) => void;
}

/**
 * Central content area: top bar (mobile), batch progress, and the active
 * surface — uploader landing screen, single-page MangaViewer, or long-strip
 * scroll view.
 *
 * Pipeline + bubble handlers come from the App, but session/translator/font
 * state is read directly from zustand to keep the prop list small.
 */
const ViewerArea: React.FC<ViewerAreaProps> = ({
  onOpenSidebar,
  onOpenRightSidebar,
  readingMode,
  setReadingMode,
  isCleanMode,
  setIsCleanMode,
  longPressTriggered,
  handleFilesSelect,
  handleTranslateOnly,
  handleCancelOcr,
  retryImage,
  onBubbleUpdate,
  onBubbleDelete,
  onBubbleAdd,
  onImageUpdate,
  onStripBubbleUpdate,
}) => {
  // Session
  const currentImage = useSessionStore(s => s.currentImage);
  const history = useSessionStore(s => s.history);
  const setCurrentImage = useSessionStore(s => s.setCurrentImage);

  // Translator UI prefs
  const targetFont = useTranslatorStore(s => s.targetFont);
  const targetBold = useTranslatorStore(s => s.targetBold);
  const targetItalic = useTranslatorStore(s => s.targetItalic);
  const globalBubbleScale = useTranslatorStore(s => s.globalBubbleScale);
  const autoTranslate = useTranslatorStore(s => s.autoTranslate);
  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const transEngine = useTranslatorStore(s => s.transEngine);

  // Fonts
  const customFonts = useFontsStore(s => s.customFonts);

  // Local navigation helpers (cheap; recompute on every render).
  const currentIndex = history.findIndex(img => img.id === currentImage?.id);
  const [desktopTopBarPortal, setDesktopTopBarPortal] = useState<HTMLDivElement | null>(null);
  const [statusBarPortal, setStatusBarPortal] = useState<HTMLDivElement | null>(null);
  const useDesktopViewerFrame = Boolean(currentImage && readingMode === 'single' && !isCleanMode);
  const handleNext = () => {
    if (currentIndex !== -1 && currentIndex < history.length - 1) {
      setCurrentImage(history[currentIndex + 1]);
    }
  };
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentImage(history[currentIndex - 1]);
  };

  return (
    <main className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-slate-950">

      {/* Mobile Top Bar (Hidden in Clean Mode) */}
      {!isCleanMode && (
        <TopBar
          onOpenSidebar={onOpenSidebar}
          onOpenRightSidebar={onOpenRightSidebar}
          readingMode={readingMode}
          onToggleReadingMode={() => setReadingMode(prev => prev === 'single' ? 'strip' : 'single')}
        />
      )}

      {/* Batch Progress Bar */}
      <BatchProgressBar />

      {/* Content View */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {!currentImage ? (
          <div className="h-full overflow-y-auto p-4 md:p-10 flex flex-col items-center justify-center">
            <div className="max-w-xl w-full text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Tradutor de Mangá
              </h2>
              <p className="text-slate-400">
                Leitura sem fronteiras. Selecione seus arquivos ou cole uma URL.
              </p>
              <Uploader onFilesSelect={handleFilesSelect} isProcessing={false} />

              <div className="pt-8 flex flex-wrap justify-center gap-3 opacity-60">
                <span className="px-3 py-1 bg-slate-800 rounded-full text-xs border border-slate-700">Gemini 2.5 Flash</span>
                <span className="px-3 py-1 bg-slate-800 rounded-full text-xs border border-slate-700">Torii Inpaint</span>
                <span className="px-3 py-1 bg-slate-800 rounded-full text-xs border border-slate-700">Auto OCR</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {readingMode === 'single' ? (
              /* Single Page Mode (Standard MangaViewer) */
              useDesktopViewerFrame ? (
                <div className="h-full min-h-0 flex flex-col bg-slate-900 rounded-lg border border-slate-700 shadow-2xl overflow-hidden">
                  <div ref={setDesktopTopBarPortal} className="shrink-0" />
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <MangaViewer
                      image={currentImage}
                      onNext={currentIndex < history.length - 1 ? handleNext : undefined}
                      onPrev={currentIndex > 0 ? handlePrev : undefined}
                      onBubbleUpdate={onBubbleUpdate}
                      onBubbleDelete={(bid) => onBubbleDelete(bid)}
                      onBubbleAdd={onBubbleAdd}
                      onImageUpdate={onImageUpdate}
                      onToggleStrip={() => setReadingMode('strip')}
                      onToggleCleanMode={() => setIsCleanMode(prev => !prev)}
                      isCleanMode={isCleanMode}
                      showOriginalText={currentImage?.status === 'ocr-done'}
                      onConfirmTranslate={() => void handleTranslateOnly(currentImage!.id)}
                      onCancelOcr={() => handleCancelOcr(currentImage!.id)}
                      defaultFont={targetFont}
                      globalBold={targetBold}
                      globalItalic={targetItalic}
                      globalBubbleScale={globalBubbleScale}
                      customFonts={customFonts}
                      onRetry={() => retryImage(currentImage!.id)}
                      totalPages={history.length}
                      currentPageIndex={currentIndex}
                      costLabel={!autoTranslate ? `~$${estimateCost(ocrEngine as EngineId, transEngine as EngineId, 1).toFixed(3)} estimado` : undefined}
                      desktopTopBarPortal={desktopTopBarPortal}
                      statusBarPortal={statusBarPortal}
                    />
                  </div>
                  <div ref={setStatusBarPortal} className="shrink-0" />
                </div>
              ) : (
                <MangaViewer
                  image={currentImage}
                  onNext={currentIndex < history.length - 1 ? handleNext : undefined}
                  onPrev={currentIndex > 0 ? handlePrev : undefined}
                  onBubbleUpdate={onBubbleUpdate}
                  onBubbleDelete={(bid) => onBubbleDelete(bid)}
                  onBubbleAdd={onBubbleAdd}
                  onImageUpdate={onImageUpdate}
                  onToggleStrip={() => setReadingMode('strip')}
                  onToggleCleanMode={() => setIsCleanMode(prev => !prev)}
                  isCleanMode={isCleanMode}
                  showOriginalText={currentImage?.status === 'ocr-done'}
                  onConfirmTranslate={() => void handleTranslateOnly(currentImage!.id)}
                  onCancelOcr={() => handleCancelOcr(currentImage!.id)}
                  defaultFont={targetFont}
                  globalBold={targetBold}
                  globalItalic={targetItalic}
                  globalBubbleScale={globalBubbleScale}
                  customFonts={customFonts}
                  onRetry={() => retryImage(currentImage!.id)}
                  totalPages={history.length}
                  currentPageIndex={currentIndex}
                  costLabel={!autoTranslate ? `~$${estimateCost(ocrEngine as EngineId, transEngine as EngineId, 1).toFixed(3)} estimado` : undefined}
                />
              )
            ) : (
              /* Long Strip Mode (Scrollable List) */
              <div className="h-full overflow-y-auto bg-slate-950 scroll-smooth pb-20">
                {/* Render all DONE images in order */}
                {history.filter(img => img.status === 'done').length === 0 && currentImage.status !== 'done' ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    Nenhuma página pronta para leitura contínua.
                  </div>
                ) : (
                  history.map((img) => (
                    <div key={img.id} className="w-full max-w-3xl mx-auto border-b border-slate-900/50">
                      <MangaViewer
                        image={img}
                        stripMode={true}
                        isCleanMode={isCleanMode}
                        defaultFont={targetFont}
                        globalBold={targetBold}
                        globalItalic={targetItalic}
                        globalBubbleScale={globalBubbleScale}
                        customFonts={customFonts}
                        onBubbleUpdate={(b) => onStripBubbleUpdate(img.id, b)}
                      />
                    </div>
                  ))
                )}

                {/* Floating Controls for Strip Mode (if not clean) */}
                {!isCleanMode && (
                  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
                    <button
                      onClick={() => setReadingMode('single')}
                      className="bg-indigo-600 text-white p-3 rounded-full shadow-xl hover:bg-indigo-700 transition-colors"
                    >
                      <ArrowsPointingInIcon className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Hint Toast for Clean Mode */}
            {!isCleanMode && !longPressTriggered && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-[10px] px-3 py-1 rounded-full pointer-events-none md:hidden opacity-50">
                Segure para tela cheia
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default ViewerArea;
