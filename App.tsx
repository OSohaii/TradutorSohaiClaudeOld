import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProcessedImage, TextBubble } from './types';
import MangaViewer, { AVAILABLE_FONTS, DEFAULT_FONT_VALUE, FontGroup } from './components/MangaViewer';
import Uploader from './components/Uploader';
import LibraryManager from './components/LibraryManager';
import { useTranslatePipeline } from './features/translator/useTranslatePipeline';
import { estimateCost } from './features/translator/costEstimation';
import Toggle from './components/ui/Toggle';
import ToastContainer from './components/ui/Toast';
import BatchProgressBar from './components/ui/BatchProgressBar';
import IchigoSettingsModal from './features/settings/IchigoSettingsModal';
import ToriiSettingsModal from './features/settings/ToriiSettingsModal';
import DeepLSettingsModal from './features/settings/DeepLSettingsModal';
import GeminiSettingsModal from './features/settings/GeminiSettingsModal';
import OpenAISettingsModal from './features/settings/OpenAISettingsModal';
import FontManagerModal from './features/settings/FontManagerModal';
import SettingsPanel from './features/settings/SettingsPanel';
import OnboardingModal from './components/OnboardingModal';
import {
  useAuthStore,
  useTranslatorStore,
  useFontsStore,
  useSessionStore,
  useLibraryStore,
  EngineId,
} from './store';
import { 
  BookOpenIcon, 
  TrashIcon, 
  ListBulletIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  SparklesIcon,
  LanguageIcon,
  ExclamationTriangleIcon,
  Bars3Icon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  DocumentDuplicateIcon,
  DocumentPlusIcon,
  BoldIcon,
  ItalicIcon,
  CommandLineIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  ViewfinderCircleIcon,
  BookmarkSquareIcon,
  ClockIcon,
  PlayIcon,
  ArrowPathIcon,
  EyeIcon,
  CheckIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  ArrowUpTrayIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  // ---- Session state (which images are loaded, which one is current) ----
  const currentImage = useSessionStore(s => s.currentImage);
  const history = useSessionStore(s => s.history);
  const setCurrentImageInStore = useSessionStore(s => s.setCurrentImage);
  const removeImageFromSession = useSessionStore(s => s.removeImage);
  const replaceSessionHistory = useSessionStore(s => s.replaceHistory);
  const updateImageStateInStore = useSessionStore(s => s.updateImageState);
  const updateBubbleInStore = useSessionStore(s => s.updateBubble);
  const updateBubbleForImage = useSessionStore(s => s.updateBubbleForImage);
  const pushBubbleSnapshotForImage = useSessionStore(s => s.pushBubbleSnapshotForImage);
  const removeBubbleInStore = useSessionStore(s => s.removeBubble);
  const addBubbleInStore = useSessionStore(s => s.addBubble);

  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'single' | 'strip'>('single');
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  // --- Engine + viewer preferences (persisted via zustand) ---
  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const setOcrEngine = useTranslatorStore(s => s.setOcrEngine);
  const transEngine = useTranslatorStore(s => s.transEngine);
  const setTransEngine = useTranslatorStore(s => s.setTransEngine);

  const sourceLanguage = useTranslatorStore(s => s.sourceLanguage);
  const setSourceLanguage = useTranslatorStore(s => s.setSourceLanguage);
  const targetLanguage = useTranslatorStore(s => s.targetLanguage);
  const setTargetLanguage = useTranslatorStore(s => s.setTargetLanguage);
  const setTargetLangCode = useTranslatorStore(s => s.setTargetLangCode);

  const targetFont = useTranslatorStore(s => s.targetFont);
  const setTargetFont = useTranslatorStore(s => s.setTargetFont);
  const targetBold = useTranslatorStore(s => s.targetBold);
  const setTargetBold = useTranslatorStore(s => s.setTargetBold);
  const targetItalic = useTranslatorStore(s => s.targetItalic);
  const setTargetItalic = useTranslatorStore(s => s.setTargetItalic);

  const globalBubbleScale = useTranslatorStore(s => s.globalBubbleScale);
  const setGlobalBubbleScale = useTranslatorStore(s => s.setGlobalBubbleScale);

  const useToriiForCleaning = useTranslatorStore(s => s.useToriiForCleaning);
  const setUseToriiForCleaning = useTranslatorStore(s => s.setUseToriiForCleaning);

  const autoTranslate = useTranslatorStore(s => s.autoTranslate);
  const setAutoTranslate = useTranslatorStore(s => s.setAutoTranslate);

  const sidebarCollapsed = useTranslatorStore(s => s.sidebarCollapsed);
  const setSidebarCollapsed = useTranslatorStore(s => s.setSidebarCollapsed);

  // Seed the font default on first run.
  useEffect(() => {
    if (!targetFont) setTargetFont(DEFAULT_FONT_VALUE);
  }, [targetFont, setTargetFont]);

  // --- Auth / BYOK keys (for sidebar indicator badges) ---
  const ichigoToken = useAuthStore(s => s.ichigoToken);
  const toriiApiKey = useAuthStore(s => s.toriiApiKey);
  const geminiApiKey = useAuthStore(s => s.geminiApiKey);
  const deepLKey = useAuthStore(s => s.deepLKey);
  const openaiApiKey = useAuthStore(s => s.openaiApiKey);

  // --- Custom fonts (for selector in sidebar) ---
  const customFonts = useFontsStore(s => s.customFonts);
  const registerLoadedFonts = useFontsStore(s => s.registerLoadedFonts);

  useEffect(() => {
    void registerLoadedFonts();
  }, [registerLoadedFonts]);

  // Legacy migration
  const runLegacyImagesMigration = useLibraryStore(s => s.runLegacyImagesMigration);
  useEffect(() => {
    void runLegacyImagesMigration();
  }, [runLegacyImagesMigration]);

  // Settings Modals
  const [showIchigoSettings, setShowIchigoSettings] = useState(false);
  const [showToriiSettings, setShowToriiSettings] = useState(false);
  const [showDeepLSettings, setShowDeepLSettings] = useState(false);
  const [showGeminiSettings, setShowGeminiSettings] = useState(false);
  const [showOpenAISettings, setShowOpenAISettings] = useState(false);
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Drag & Drop state
  const [isDragOverWindow, setIsDragOverWindow] = useState(false);
  const dragCounter = useRef(0);

  // Track items that have already played their shake animation (one-shot)
  const [shakenItems, setShakenItems] = useState<Set<string>>(new Set());

  // Clear shakenItems when items leave error state so they can re-animate if error recurs
  useEffect(() => {
    setShakenItems(prev => {
      const updated = new Set(prev);
      let changed = false;
      for (const id of prev) {
        const item = history.find(h => h.id === id);
        if (!item || item.status !== 'error') {
          updated.delete(id);
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }, [history]);

  // Unified settings panel
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);

  // --- Translation pipeline hook ---
  const onAuthError = useCallback((modal: 'ichigo' | 'torii' | 'deepl' | 'gemini' | 'openai') => {
    switch (modal) {
      case 'ichigo': setShowIchigoSettings(true); break;
      case 'torii': setShowToriiSettings(true); break;
      case 'deepl': setShowDeepLSettings(true); break;
      case 'gemini': setShowGeminiSettings(true); break;
      case 'openai': setShowOpenAISettings(true); break;
    }
  }, []);

  const { handleFilesSelect: pipelineFilesSelect, handleRetranslate, handleTranslateImage, handleTranslateAll, handleOcrOnly, handleTranslateOnly, handleCancelOcr, retryImage, totalCost, displayedTotalTokens } = useTranslatePipeline({
    onAuthError,
  });

  const handleFilesSelect = async (files: File[]) => {
    const started = await pipelineFilesSelect(files);
    if (started) setIsSidebarOpen(false);
  };

  // --- Long Press Logic for Clean Mode ---
  const timerRef = useRef<number | null>(null);

  const handleTouchStart = () => {
    timerRef.current = window.setTimeout(() => {
      setIsCleanMode(prev => !prev);
      setLongPressTriggered(true);
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); // 600ms hold
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Reset trigger flag after a short delay so click events don't fire immediately if it was a long press
    setTimeout(() => setLongPressTriggered(false), 100);
  };

  // --- Global Drag & Drop Handlers ---
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

  // Merge fonts for the selector (used by font <select> in sidebar)
  const availableFontsForSelector = useMemo(() => {
    if (customFonts.length === 0) return AVAILABLE_FONTS;
    const customGroup: FontGroup = {
      group: 'Fontes Personalizadas',
      type: 'group',
      options: customFonts
    };
    return [customGroup, ...AVAILABLE_FONTS];
  }, [customFonts]);

  // Handler para carregar capitulo da biblioteca
  const handleLoadFromLibrary = (images: ProcessedImage[]) => {
    replaceSessionHistory(images);
    setIsSidebarOpen(false);
  };

  // State Updates — kept as a thin wrapper so the JSX below doesn't
  // need to know about the store directly. The store handles applying
  // the partial to both `history[i]` and `currentImage` atomically.
  const updateImageState = (id: string, partial: Partial<ProcessedImage>) => {
    updateImageStateInStore(id, partial);
  };

  const handleBubbleUpdate = (bubble: TextBubble) => {
    updateBubbleInStore(bubble);
  };

  const handleBubbleDelete = (bubbleId: string) => {
    removeBubbleInStore(bubbleId);
  };

  const handleBubbleAdd = (bubble: TextBubble) => {
    addBubbleInStore(bubble);
  };

  const handleImageUpdate = (img: ProcessedImage) => {
    updateImageStateInStore(img.id, img);
  };

  // Navigation
  const getCurrentIndex = () => history.findIndex(img => img.id === currentImage?.id);
  const handleNext = () => {
    const idx = getCurrentIndex();
    if (idx !== -1 && idx < history.length - 1) setCurrentImageInStore(history[idx + 1]);
  };
  const handlePrev = () => {
    const idx = getCurrentIndex();
    if (idx > 0) setCurrentImageInStore(history[idx - 1]);
  };

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
      
      {/* --- Global Drag & Drop Overlay --- */}
      {isDragOverWindow && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="border-2 border-dashed border-indigo-400 rounded-2xl p-12 flex flex-col items-center gap-4 animate-drag-pulse">
            <ArrowUpTrayIcon className="w-16 h-16 text-indigo-400" />
            <p className="text-xl font-bold text-white">Solte aqui para traduzir</p>
            <p className="text-sm text-slate-400">Arraste imagens de manga para iniciar</p>
          </div>
        </div>
      )}

      {/* --- Mobile Sidebar Overlay --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- Sidebar (Drawer on Mobile, Fixed on Desktop) --- */}
      <aside className={`
        fixed md:relative z-50 h-full w-[85vw] ${sidebarCollapsed ? 'md:w-16' : 'md:w-80'} bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
           <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'md:justify-center md:w-full' : ''}`}>
             <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
               <BookOpenIcon className="w-5 h-5 text-white" />
             </div>
             <div className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>
               <h1 className="font-bold text-lg leading-none tracking-tight">MangaLens</h1>
               <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">AI Translator</span>
                  {/* Token Usage Badge */}
                  <div className={`flex items-center gap-1 border rounded-md px-1.5 py-0.5 ${displayedTotalTokens > 0 ? 'bg-emerald-900/40 border-emerald-500/30' : 'bg-slate-800/40 border-slate-700/50'}`}>
                      <span className={`text-[9px] font-mono font-bold ${displayedTotalTokens > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {displayedTotalTokens > 1000 ? `${(displayedTotalTokens/1000).toFixed(1)}k` : displayedTotalTokens} Tk
                      </span>
                      {displayedTotalTokens > 0 && (
                        <span className="text-[8px] text-emerald-500/70 border-l border-emerald-500/30 pl-1 ml-0.5">
                          ${totalCost.toFixed(4)}
                        </span>
                      )}
                  </div>
               </div>
             </div>
           </div>
           <div className="flex items-center gap-1">
             {/* Collapse toggle (desktop only) */}
             <button
               onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
               className="hidden md:flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
               title={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
             >
               {sidebarCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
             </button>
             <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-slate-400">
               <XMarkIcon className="w-6 h-6" />
             </button>
           </div>
        </div>
        
        {/* History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
           {history.length === 0 ? (
             <div className={`flex flex-col items-center justify-center h-40 text-slate-600 space-y-2 ${sidebarCollapsed ? 'md:px-1' : ''}`}>
               <DocumentDuplicateIcon className="w-8 h-8 opacity-50" />
               <span className={`text-xs ${sidebarCollapsed ? 'md:hidden' : ''}`}>Sem historico recente</span>
             </div>
           ) : (
             <>
               {history.some(item => item.status === 'idle') && !sidebarCollapsed && (
                 <>
                 <button
                   onClick={() => void handleTranslateAll()}
                   className="w-full py-2 mb-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                 >
                   <PlayIcon className="w-4 h-4" />
                   Traduzir Todas
                 </button>
                 {!autoTranslate && (
                   <p className="text-[10px] text-slate-500 text-center mb-2">
                     ~${estimateCost(ocrEngine as EngineId, transEngine as EngineId, history.filter(i => i.status === 'idle').length).toFixed(3)} estimado
                   </p>
                 )}
                 </>
               )}
               {history.map((item, idx) => (
               <div 
                 key={item.id}
                 onClick={() => { setCurrentImageInStore(item); setIsSidebarOpen(false); }}
                 className={`
                   group flex items-center ${sidebarCollapsed ? 'md:justify-center md:p-1 md:relative' : 'p-2'} rounded-xl cursor-pointer transition-all border
                   ${currentImage?.id === item.id 
                     ? 'bg-indigo-600/10 border-indigo-500/50 shadow-sm' 
                     : 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-700'}
                   ${item.status === 'error' && !shakenItems.has(item.id) ? 'animate-shake' : ''}
                 `}
                 onAnimationEnd={() => {
                   if (item.status === 'error') {
                     setShakenItems(prev => new Set(prev).add(item.id));
                   }
                 }}
               >
                 <div className={`relative h-10 w-10 rounded-lg bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-800 ${item.status === 'processing' ? 'ring-2 ring-indigo-500 animate-pulse' : ''}`}>
                   <img src={item.imageUrl} className="h-full w-full object-cover" loading="lazy" />
                   {item.status === 'processing' && (
                     <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                       <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
                     </div>
                   )}
                   {item.status === 'idle' && (
                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                       <ClockIcon className="w-4 h-4 text-indigo-300" />
                     </div>
                   )}
                   {item.status === 'ocr-done' && (
                     <div className="absolute inset-0 bg-amber-900/60 flex items-center justify-center">
                       <EyeIcon className="w-4 h-4 text-amber-200" />
                     </div>
                   )}
                   {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-200" />
                      </div>
                   )}
                   {/* Done checkmark badge */}
                   {item.status === 'done' && (
                     <div className="absolute -top-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 animate-scale-in">
                       <CheckIcon className="w-2.5 h-2.5 text-white" />
                     </div>
                   )}
                 </div>
                 <div className={`ml-3 flex-1 min-w-0 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-1.5">
                       {/* Status dot indicator */}
                       <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                         item.status === 'done' ? 'bg-green-500' :
                         item.status === 'processing' ? 'bg-blue-500' :
                         item.status === 'error' ? 'bg-red-500' :
                         item.status === 'ocr-done' ? 'bg-orange-500' :
                         'bg-slate-500'
                       }`} />
                       <p className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{item.fileName}</p>
                     </div>
                     <span className="text-[9px] text-slate-500">#{idx + 1}</span>
                   </div>
                   <p className={`text-[10px] truncate ${item.status === 'error' ? 'text-red-400' : item.status === 'idle' ? 'text-indigo-400' : item.status === 'ocr-done' ? 'text-amber-400' : 'text-slate-500'}`}>
                     {item.status === 'processing' ? 'Traduzindo...' : item.status === 'done' ? 'Concluido' : item.status === 'idle' ? 'Pendente' : item.status === 'ocr-done' ? 'OCR Pronto' : 'Falha'}
                   </p>
                 </div>
                 <div className={`${sidebarCollapsed ? 'md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 md:bg-slate-800 md:rounded-lg md:shadow-lg md:border md:border-slate-700 md:p-1 md:flex md:items-center md:z-10' : ''} flex items-center`}>
                 {item.status === 'idle' && (
                   <button
                     onClick={(e) => { e.stopPropagation(); void handleTranslateImage(item.id); }}
                     className="p-1.5 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg transition-all"
                     title="Traduzir"
                   >
                     <PlayIcon className="w-4 h-4" />
                   </button>
                 )}
                 {item.status === 'ocr-done' && (
                   <>
                     <button
                       onClick={(e) => { e.stopPropagation(); void handleTranslateOnly(item.id); }}
                       className="p-1.5 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg transition-all"
                       title="Confirmar e Traduzir"
                     >
                       <CheckIcon className="w-4 h-4" />
                     </button>
                     <button
                       onClick={(e) => { e.stopPropagation(); handleCancelOcr(item.id); }}
                       className="p-1.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-all"
                       title="Cancelar OCR"
                     >
                       <XCircleIcon className="w-4 h-4" />
                     </button>
                   </>
                 )}
                 {item.status === 'error' && (
                   <button
                     onClick={(e) => { e.stopPropagation(); void retryImage(item.id); }}
                     className="p-1.5 hover:bg-amber-500/10 hover:text-amber-400 text-amber-500 rounded-lg transition-all"
                     title="Tentar novamente"
                   >
                     <ArrowPathIcon className="w-4 h-4" />
                   </button>
                 )}
                 <button 
                   onClick={(e) => { e.stopPropagation(); removeImageFromSession(item.id); }}
                   className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                 >
                   <TrashIcon className="w-4 h-4" />
                 </button>
                 </div>
               </div>
             ))}
             </>
           )}
        </div>

        {/* Sidebar Footer Controls */}
        <div className={`p-4 bg-slate-900 border-t border-slate-800 space-y-4 ${sidebarCollapsed ? 'md:p-2 md:space-y-2' : ''}`}>
           {/* OCR & Translation Selectors */}
           <div className={`space-y-3 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><ViewfinderCircleIcon className="w-3.5 h-3.5"/> OCR</span>
                <select value={ocrEngine} onChange={(e) => setOcrEngine(e.target.value as EngineId)} className="bg-slate-800 border-none text-slate-200 text-xs rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 max-w-[140px] truncate">
                   <option value="GEMINI_FLASH">Gemini 2.5 Flash</option>
                   <option value="GEMINI_FLASH_FULL">Gemini 2.5 Flash (Full)</option>
                   <option value="GEMINI_35_FLASH">Gemini 3.5 Flash</option>
                   <option value="GEMINI_35_FLASH_FULL">Gemini 3.5 Flash (Full)</option>
                   <option value="GEMINI_3_FLASH">Gemini 3 Flash</option>
                   <option value="GEMINI_3_FLASH_FULL">Gemini 3 Flash (Full)</option>
                   <option value="GEMINI_PRO">Gemini 3.1 Pro</option>
                   <option value="GEMINI_PRO_FULL">Gemini 3.1 Pro (Full)</option>
                   <option value="GPT4O">GPT-4o</option>
                   <option value="GPT4O_MINI">GPT-4o Mini</option>
                   <option value="ICHIGO">Ichigo</option>
                   <option value="TORII">Torii (Full)</option>
                </select>
              </div>
              <div className={`flex justify-between items-center text-xs transition-opacity ${(ocrEngine === 'GEMINI_PRO_FULL' || ocrEngine === 'GEMINI_FLASH_FULL' || ocrEngine === 'GEMINI_3_FLASH_FULL' || ocrEngine === 'GEMINI_35_FLASH_FULL') ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                <span className="text-slate-400 flex items-center gap-1.5"><ChatBubbleLeftRightIcon className="w-3.5 h-3.5"/> Tradutor</span>
                <select 
                    value={transEngine} 
                    onChange={(e) => setTransEngine(e.target.value as EngineId)} 
                    className="bg-slate-800 border-none text-slate-200 text-xs rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 max-w-[140px] truncate"
                    disabled={ocrEngine === 'GEMINI_PRO_FULL' || ocrEngine === 'GEMINI_FLASH_FULL' || ocrEngine === 'GEMINI_3_FLASH_FULL' || ocrEngine === 'GEMINI_35_FLASH_FULL'}
                >
                   {ocrEngine === 'GEMINI_PRO_FULL' || ocrEngine === 'GEMINI_FLASH_FULL' || ocrEngine === 'GEMINI_3_FLASH_FULL' || ocrEngine === 'GEMINI_35_FLASH_FULL' ? (
                       <option>Integrado (Full)</option>
                   ) : (
                       <>
                           <option value="GEMINI_35_FLASH">Gemini 3.5 Flash</option>
                           <option value="GEMINI_PRO">Gemini 3.1 Pro</option>
                           <option value="GEMINI_FLASH">Gemini 2.5 Flash</option>
                           <option value="GPT4O">GPT-4o</option>
                           <option value="GPT4O_MINI">GPT-4o Mini</option>
                           <option value="DEEPL">DeepL</option>
                           <option value="GOOGLE">Google</option>
                           <option value="TORII">Torii</option>
                       </>
                   )}
                </select>
              </div>

              {/* Source & Target Language Selectors */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><LanguageIcon className="w-3.5 h-3.5"/> Origem</span>
                <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} className="bg-slate-800 border-none text-slate-200 text-xs rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 max-w-[140px] truncate">
                   <option value="Japanese">Japanese</option>
                   <option value="Korean">Korean</option>
                   <option value="Chinese (Simplified)">Chinese (Simplified)</option>
                   <option value="Chinese (Traditional)">Chinese (Traditional)</option>
                   <option value="English">English</option>
                   <option value="Spanish">Spanish</option>
                   <option value="French">French</option>
                </select>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><LanguageIcon className="w-3.5 h-3.5"/> Alvo</span>
                <select value={targetLanguage} onChange={(e) => {
                  const val = e.target.value;
                  setTargetLanguage(val);
                  const codeMap: Record<string, string> = {
                    'Portugues (Brasil)': 'pt-BR',
                    'English': 'en',
                    'Spanish': 'es',
                    'French': 'fr',
                    'Japanese': 'ja',
                    'Korean': 'ko',
                  };
                  setTargetLangCode(codeMap[val] || 'pt-BR');
                }} className="bg-slate-800 border-none text-slate-200 text-xs rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 max-w-[140px] truncate">
                   <option value="Portugues (Brasil)">Portugues (Brasil)</option>
                   <option value="English">English</option>
                   <option value="Spanish">Spanish</option>
                   <option value="French">French</option>
                   <option value="Japanese">Japanese</option>
                   <option value="Korean">Korean</option>
                </select>
              </div>

              {/* Font Selector & Styles */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5"><ListBulletIcon className="w-3.5 h-3.5"/> Fonte</span>
                <div className="flex items-center gap-2">
                    <select value={targetFont} onChange={(e) => setTargetFont(e.target.value)} className="bg-slate-800 border-none text-slate-200 text-xs rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 max-w-[100px] truncate">
                       {availableFontsForSelector.map((font, idx) => {
                          if ('group' in font) {
                            return (
                              <optgroup key={idx} label={font.group}>
                                {font.options.map((opt, subIdx) => (
                                  <option key={`${idx}-${subIdx}`} value={opt.value}>{opt.name}</option>
                                ))}
                              </optgroup>
                            );
                          }
                          return <option key={idx} value={font.value}>{font.name}</option>;
                       })}
                    </select>
                    
                    {/* Bold/Italic Toggles */}
                    <div className="flex bg-slate-800 rounded-md border border-slate-700 p-0.5">
                       <button 
                         onClick={() => setTargetBold(!targetBold)} 
                         className={`p-1 rounded transition-colors ${targetBold ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                         title="Negrito"
                       >
                         <BoldIcon className="w-3.5 h-3.5" />
                       </button>
                       <button 
                         onClick={() => setTargetItalic(!targetItalic)} 
                         className={`p-1 rounded transition-colors ${targetItalic ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                         title="Itálico"
                       >
                         <ItalicIcon className="w-3.5 h-3.5" />
                       </button>
                    </div>
                </div>
              </div>

              {/* Global Bubble Scale Slider */}
               <div className="space-y-1 pt-1">
                 <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Tamanho dos Balões</span>
                    <span>{Math.round(globalBubbleScale * 100)}%</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setGlobalBubbleScale(Math.max(0.5, globalBubbleScale - 0.1))} className="text-slate-500 hover:text-white"><MinusCircleIcon className="w-4 h-4" /></button>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.05" 
                      value={globalBubbleScale} 
                      onChange={(e) => setGlobalBubbleScale(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <button onClick={() => setGlobalBubbleScale(Math.min(1.5, globalBubbleScale + 0.1))} className="text-slate-500 hover:text-white"><PlusCircleIcon className="w-4 h-4" /></button>
                 </div>
               </div>

              {/* Hybrid Cleaning Mode Toggle (Torii Inpaint) */}
              {ocrEngine !== 'TORII' && transEngine !== 'TORII' && (
                 <div className="pt-2 border-t border-slate-800">
                   <Toggle 
                     label={
                        <span className="flex items-center gap-1.5" title="Usa Torii apenas para limpar balões">
                           <SparklesIcon className={`w-3.5 h-3.5 ${useToriiForCleaning ? 'text-pink-400' : 'text-slate-500'}`} />
                           Limpar com Torii
                        </span>
                     } 
                     checked={useToriiForCleaning} 
                     onChange={() => {
                        setUseToriiForCleaning(!useToriiForCleaning);
                        if (!useToriiForCleaning && !toriiApiKey) setShowToriiSettings(true);
                     }} 
                     colorClass="bg-pink-600"
                   />
                 </div>
              )}

              {/* Auto-translate Toggle */}
              <div className="pt-2 border-t border-slate-800">
                <Toggle
                  label={
                    <span className="flex items-center gap-1.5" title="Traduzir automaticamente ao fazer upload">
                      <LanguageIcon className={`w-3.5 h-3.5 ${autoTranslate ? 'text-indigo-400' : 'text-slate-500'}`} />
                      Auto-traduzir
                    </span>
                  }
                  checked={autoTranslate}
                  onChange={() => setAutoTranslate(!autoTranslate)}
                  colorClass="bg-indigo-600"
                />
              </div>
           </div>
           
           {/* Library Button */}
           <button 
             onClick={() => setShowLibrary(true)}
             className={`w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 ${sidebarCollapsed ? 'md:p-2' : ''}`}
             title="Minha Biblioteca"
           >
             <BookmarkSquareIcon className="w-5 h-5" />
             <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Minha Biblioteca</span>
           </button>
           
           {/* Settings Buttons Grid */}
           <div className={`grid gap-2 ${sidebarCollapsed ? 'md:grid-cols-1' : 'grid-cols-8'}`}>
              <button onClick={() => setShowIchigoSettings(true)} className={`p-2 rounded-xl flex items-center justify-center border ${ichigoToken ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`} title="Ichigo"><UserCircleIcon className="w-5 h-5"/></button>
              <button onClick={() => setShowToriiSettings(true)} className={`p-2 rounded-xl flex items-center justify-center border ${toriiApiKey ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`} title="Torii"><SparklesIcon className="w-5 h-5"/></button>
              <button onClick={() => setShowDeepLSettings(true)} className={`p-2 rounded-xl flex items-center justify-center border ${deepLKey ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`} title="DeepL"><LanguageIcon className="w-5 h-5"/></button>
              <button onClick={() => setShowGeminiSettings(true)} className={`p-2 rounded-xl flex items-center justify-center border ${geminiApiKey ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`} title="Google Gemini Key (BYOK)"><CommandLineIcon className="w-5 h-5"/></button>
              <button onClick={() => setShowOpenAISettings(true)} className={`p-2 rounded-xl flex items-center justify-center border ${openaiApiKey ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`} title="OpenAI Key (BYOK)"><SparklesIcon className="w-5 h-5"/></button>
              <button onClick={() => setShowFontSettings(true)} className="p-2 rounded-xl flex items-center justify-center border bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700" title="Gerenciar Fontes"><DocumentPlusIcon className="w-5 h-5"/></button>
              <button onClick={() => setShowSettingsPanel(true)} className="p-2 rounded-xl flex items-center justify-center border bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-indigo-400" title="Configuracoes"><Cog6ToothIcon className="w-5 h-5"/></button>
              <button onClick={() => { localStorage.removeItem('mangalens-onboarding-done'); setShowOnboarding(true); }} className="p-2 rounded-xl flex items-center justify-center border bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-amber-400" title="Tutorial"><QuestionMarkCircleIcon className="w-5 h-5"/></button>
           </div>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-slate-950">
        
        {/* Mobile Top Bar (Hidden in Clean Mode) */}
        {!isCleanMode && (
          <header className="md:hidden h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30 shadow-lg">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-300">
               <Bars3Icon className="w-6 h-6" />
             </button>
             <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                {currentImage ? currentImage.fileName : 'MangaLens'}
             </span>
             {currentImage && (
                <button 
                  onClick={() => setReadingMode(prev => prev === 'single' ? 'strip' : 'single')}
                  className="p-2 -mr-2 text-indigo-400"
                  title={readingMode === 'single' ? "Modo Página Única" : "Modo Long Strip"}
                >
                  {readingMode === 'single' ? <ArrowsPointingOutIcon className="w-5 h-5" /> : <ArrowsPointingInIcon className="w-5 h-5" />}
                </button>
             )}
          </header>
        )}

        {/* Batch Progress Bar */}
        <BatchProgressBar />

        {/* Content View */}
        <div className="flex-1 overflow-hidden relative">
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
                 <MangaViewer 
                   image={currentImage}
                   onNext={getCurrentIndex() < history.length - 1 ? handleNext : undefined}
                   onPrev={getCurrentIndex() > 0 ? handlePrev : undefined}
                   onBubbleUpdate={handleBubbleUpdate}
                   onBubbleDelete={(bid) => handleBubbleDelete(bid)}
                   onBubbleAdd={handleBubbleAdd}
                   onImageUpdate={handleImageUpdate}
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
                   currentPageIndex={getCurrentIndex()}
                   costLabel={!autoTranslate ? `~$${estimateCost(ocrEngine as EngineId, transEngine as EngineId, 1).toFixed(3)} estimado` : undefined}
                 />
               ) : (
                 /* Long Strip Mode (Scrollable List) */
                 <div className="h-full overflow-y-auto bg-slate-950 scroll-smooth pb-20">
                    {/* Render all DONE images in order */}
                    {history.filter(img => img.status === 'done').length === 0 && currentImage.status !== 'done' ? (
                       <div className="flex items-center justify-center h-full text-slate-500">
                          Nenhuma página pronta para leitura contínua.
                       </div>
                    ) : (
                       history.map((img, idx) => (
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
                              onBubbleUpdate={(b) => {
                                 pushBubbleSnapshotForImage(img.id);
                                 updateBubbleForImage(img.id, b);
                              }}
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

      {/* --- Modals (Settings) --- */}
      <FontManagerModal isOpen={showFontSettings} onClose={() => setShowFontSettings(false)} />
      <IchigoSettingsModal isOpen={showIchigoSettings} onClose={() => setShowIchigoSettings(false)} />
      <ToriiSettingsModal isOpen={showToriiSettings} onClose={() => setShowToriiSettings(false)} />
      <DeepLSettingsModal isOpen={showDeepLSettings} onClose={() => setShowDeepLSettings(false)} />
      <GeminiSettingsModal isOpen={showGeminiSettings} onClose={() => setShowGeminiSettings(false)} />
      <OpenAISettingsModal isOpen={showOpenAISettings} onClose={() => setShowOpenAISettings(false)} />
      <SettingsPanel isOpen={showSettingsPanel} onClose={() => setShowSettingsPanel(false)} onOpenIchigoLogin={() => setShowIchigoSettings(true)} />

      {/* Library Manager */}
      <LibraryManager
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        currentHistory={history}
        onLoadChapter={handleLoadFromLibrary}
      />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Onboarding Modal */}
      <OnboardingModal forceOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

    </div>
  );
};

export default App;