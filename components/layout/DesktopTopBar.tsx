import React from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  PaintBrushIcon,
  SquaresPlusIcon,
  StopIcon,
  CubeTransparentIcon,
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ViewMode } from '../../types';

interface DesktopTopBarProps {
  onPrev?: () => void;
  onNext?: () => void;
  imageStatus: string;
  isFullServerResult: boolean;
  hasOverlays: boolean;
  isOcrDone: boolean;
  
  handleDownload: () => void;
  setShowComparison: (val: boolean) => void;
  
  isPaintMode: boolean;
  setIsPaintMode: (val: boolean) => void;
  
  isEditingMode: boolean;
  setIsEditingMode: (val: boolean) => void;
  
  isAddingBubble: boolean;
  setIsAddingBubble: (val: boolean) => void;
  
  hideBubbleBorders: boolean;
  setHideBubbleBorders: (val: boolean) => void;
  
  isBubbleTransparent: boolean;
  setIsBubbleTransparent: (val: boolean) => void;
  
  viewMode: ViewMode;
  setViewMode: (val: ViewMode | ((prev: ViewMode) => ViewMode)) => void;
  
  onConfirmTranslate?: () => void;
  onCancelOcr?: () => void;
}

const DesktopTopBar: React.FC<DesktopTopBarProps> = ({
  onPrev,
  onNext,
  imageStatus,
  isFullServerResult,
  hasOverlays,
  isOcrDone,
  
  handleDownload,
  setShowComparison,
  
  isPaintMode,
  setIsPaintMode,
  
  isEditingMode,
  setIsEditingMode,
  
  isAddingBubble,
  setIsAddingBubble,
  
  hideBubbleBorders,
  setHideBubbleBorders,
  
  isBubbleTransparent,
  setIsBubbleTransparent,
  
  viewMode,
  setViewMode,

  onConfirmTranslate,
  onCancelOcr,
}) => {
  return (
    <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 md:px-4 sticky top-0 z-50 shrink-0">
      {/* Left side: Navigation & Status */}
      <div className="flex items-center space-x-2">
        <button onClick={onPrev} disabled={!onPrev} className={`p-1.5 rounded-lg transition-colors ${onPrev ? 'text-white hover:bg-slate-800' : 'text-slate-700'}`}>
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button onClick={onNext} disabled={!onNext} className={`p-1.5 rounded-lg transition-colors ${onNext ? 'text-white hover:bg-slate-800' : 'text-slate-700'}`}>
          <ChevronRightIcon className="w-5 h-5" />
        </button>
        
        <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>
        
        <span className={`text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded ${imageStatus === 'done' ? 'bg-green-500/10 text-green-400' : imageStatus === 'ocr-done' ? 'bg-amber-500/10 text-amber-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
          {imageStatus === 'done' ? (isFullServerResult ? 'IMG' : 'COMPLETO') : imageStatus === 'ocr-done' ? 'REVISÃO' : '...'}
        </span>
      </div>

      {/* Center/Right Actions */}
      <div className="flex items-center gap-1 md:gap-2">
        
        {/* OCR Review Action Buttons (Lifted into TopBar instead of floating) */}
        {isOcrDone && (
          <div className="flex items-center gap-2 mr-2 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
            {onConfirmTranslate && (
              <button
                onClick={onConfirmTranslate}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium rounded md:text-xs transition-colors flex items-center gap-1.5"
              >
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                Confirmar OCR
              </button>
            )}
            {onCancelOcr && (
              <button
                onClick={onCancelOcr}
                className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded transition-colors"
                title="Cancelar OCR"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {(imageStatus === 'done' || isOcrDone) && hasOverlays && (
          <>
            <button onClick={handleDownload} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Baixar Página">
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            {imageStatus === 'done' && (
              <button onClick={() => setShowComparison(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Comparar Original/Traduzido">
                <ArrowsRightLeftIcon className="w-5 h-5" />
              </button>
            )}
            
            <div className="h-6 w-px bg-slate-800 mx-1"></div>
            
            <button onClick={() => { setIsPaintMode(!isPaintMode); setIsEditingMode(false); setIsAddingBubble(false); }} className={`p-2 rounded-lg transition-colors ${isPaintMode ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Pintar (Inpaint Manual)">
              <PaintBrushIcon className="w-5 h-5" />
            </button>
            <button onClick={() => { setIsEditingMode(!isEditingMode); setIsPaintMode(false); setIsAddingBubble(false); }} className={`p-2 rounded-lg transition-colors ${isEditingMode ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Modo de Edição">
              <PencilSquareIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setIsAddingBubble(!isAddingBubble); setIsPaintMode(false); setIsEditingMode(false); }} 
              className={`p-2 rounded-lg transition-colors ${isAddingBubble ? 'bg-green-600 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} 
              title="Adicionar Balão"
            >
              <SquaresPlusIcon className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setHideBubbleBorders(!hideBubbleBorders)} className={`p-1.5 rounded-md transition-colors ${hideBubbleBorders ? 'text-indigo-400 bg-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} title="Ocultar Bordas">
                <StopIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setIsBubbleTransparent(!isBubbleTransparent)} className={`p-1.5 rounded-md transition-colors ${isBubbleTransparent ? 'text-indigo-400 bg-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} title="Fundo Transparente">
                <CubeTransparentIcon className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Comparison button for full server results (no overlays) */}
        {imageStatus === 'done' && isFullServerResult && (
          <button onClick={() => setShowComparison(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Comparar Original/Traduzido">
            <ArrowsRightLeftIcon className="w-5 h-5" />
          </button>
        )}
        
        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block"></div>

        <button onClick={() => setViewMode(prev => prev === ViewMode.TRANSLATED ? ViewMode.ORIGINAL : ViewMode.TRANSLATED)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Alternar Visão">
           {viewMode === ViewMode.TRANSLATED ? <EyeIcon className="w-5 h-5"/> : <EyeSlashIcon className="w-5 h-5"/>}
        </button>
      </div>
    </div>
  );
};

export default DesktopTopBar;
