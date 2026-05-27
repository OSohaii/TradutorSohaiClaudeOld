import React from 'react';
import { TextBubble } from '../types';
import { FontOption, FontGroup } from './MangaViewer';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  Bars3BottomLeftIcon,
  Bars3Icon,
  Bars3BottomRightIcon,
} from '@heroicons/react/24/outline';

interface ViewerToolbarProps {
  activeBubble: TextBubble;
  currentBubbleIndex: number;
  totalBubbles: number;
  calculatedFontSizes: Record<string, number>;
  defaultFont?: string;
  allFonts: (FontOption | FontGroup)[];
  copiedStyle: Partial<TextBubble> | null;
  canUndo: boolean;
  canRedo: boolean;
  // Callbacks
  navigateBubble: (direction: 'next' | 'prev') => void;
  copyStyle: () => void;
  pasteStyle: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  saveToHistory: () => void;
  onBubbleUpdate?: (bubble: TextBubble) => void;
  onBubbleDelete?: (bubbleId: string) => void;
  startEditingBubble: (bubble: TextBubble | null) => void;
}

const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
  activeBubble,
  currentBubbleIndex,
  totalBubbles,
  calculatedFontSizes,
  defaultFont,
  allFonts,
  copiedStyle,
  canUndo,
  canRedo,
  navigateBubble,
  copyStyle,
  pasteStyle,
  handleUndo,
  handleRedo,
  saveToHistory,
  onBubbleUpdate,
  onBubbleDelete,
  startEditingBubble,
}) => {
  return (
    <div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-900/95 backdrop-blur-sm border border-slate-700 p-3 rounded-2xl shadow-2xl animate-fade-in-up max-w-[95vw]"
      onMouseDown={(e) => e.stopPropagation()} 
      onClick={(e) => e.stopPropagation()}
    >
       {/* Header com navegacao e botao de fechar */}
       <div className="flex items-center justify-between mb-3 gap-4">
         <div className="flex items-center gap-2">
            {/* Navegacao entre baloes */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
              <button 
                onClick={() => navigateBubble('prev')}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Balão anterior (Shift+Tab)"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-xs text-indigo-400 font-mono px-2">
                {currentBubbleIndex + 1}/{totalBubbles}
              </span>
              <button 
                onClick={() => navigateBubble('next')}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Próximo balão (Tab)"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
            
            <span className="text-xs font-bold text-white">Editar Balão</span>
            <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded-md font-mono">
               {activeBubble.fontSize || (calculatedFontSizes[activeBubble.id] ? Math.round(calculatedFontSizes[activeBubble.id]) : 'Auto')}px
            </span>
         </div>
         
         <div className="flex items-center gap-1">
            {/* Copiar/Colar estilo */}
            <button 
              onClick={copyStyle}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Copiar estilo (Ctrl+Shift+C)"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
            </button>
            <button 
              onClick={pasteStyle}
              disabled={!copiedStyle}
              className={`p-1.5 rounded-lg transition-colors ${copiedStyle ? 'text-indigo-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}`}
              title="Colar estilo (Ctrl+Shift+V)"
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
            </button>
            
            {/* Undo/Redo */}
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button 
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg transition-colors ${canUndo ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}`}
              title="Desfazer (Ctrl+Z)"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
            <button 
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg transition-colors ${canRedo ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'}`}
              title="Refazer (Ctrl+Shift+Z)"
            >
              <ArrowUturnRightIcon className="w-4 h-4" />
            </button>
            
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button 
              onClick={() => startEditingBubble(null)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Fechar (ESC)"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
         </div>
       </div>

       {/* Linha 1: Fonte, Tamanho, Cor, B/I */}
       <div className="flex items-center gap-2 flex-wrap mb-2">
          {/* Fonte */}
          <select 
            value={activeBubble.fontFamily || defaultFont} 
            onChange={(e) => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, fontFamily: e.target.value }); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 max-w-[130px]"
          >
            {allFonts.map((font, idx) => {
              if ('group' in font) return (
                <optgroup key={idx} label={font.group}>
                  {font.options.map((opt, subIdx) => (
                    <option key={`${idx}-${subIdx}`} value={opt.value}>{opt.name}</option>
                  ))}
                </optgroup>
              );
              return <option key={idx} value={font.value}>{font.name}</option>;
            })}
          </select>
          
          {/* Tamanho com botoes +/- */}
          <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700">
            <button 
              onClick={() => {
                const currentSize = activeBubble.fontSize || calculatedFontSizes[activeBubble.id] || 14;
                saveToHistory();
                onBubbleUpdate && onBubbleUpdate({ ...activeBubble, fontSize: Math.max(currentSize - 2, 6) });
              }}
              className="px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-l-lg"
              title="Diminuir fonte (-)"
            >
              <MinusIcon className="w-3 h-3" />
            </button>
            <input 
              type="number" 
              value={activeBubble.fontSize || ''} 
              onChange={(e) => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, fontSize: parseInt(e.target.value) || undefined }); }}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Auto"
              className="w-12 bg-transparent text-white text-xs text-center border-x border-slate-700 py-1.5"
            />
            <button 
              onClick={() => {
                const currentSize = activeBubble.fontSize || calculatedFontSizes[activeBubble.id] || 14;
                saveToHistory();
                onBubbleUpdate && onBubbleUpdate({ ...activeBubble, fontSize: Math.min(currentSize + 2, 120) });
              }}
              className="px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-r-lg"
              title="Aumentar fonte (+)"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          {/* Separador */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Cor do texto */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg border border-slate-700 px-2 py-1">
            <span className="text-[10px] text-slate-500">Cor</span>
            <input 
              type="color"
              value={activeBubble.color || '#000000'}
              onChange={(e) => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, color: e.target.value }); }}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              title="Cor do texto"
            />
          </div>

          {/* Separador */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Negrito/Italico */}
          <div className="flex bg-slate-800 rounded-lg border border-slate-700">
            <button 
              onClick={() => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, fontWeight: activeBubble.fontWeight === 'bold' ? 'normal' : 'bold' }); }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-l-lg transition-colors ${activeBubble.fontWeight === 'bold' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Negrito (Ctrl+B)"
            >
              B
            </button>
            <button 
              onClick={() => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, fontStyle: activeBubble.fontStyle === 'italic' ? 'normal' : 'italic' }); }}
              className={`px-2.5 py-1.5 text-xs italic font-serif rounded-r-lg border-l border-slate-700 transition-colors ${activeBubble.fontStyle === 'italic' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Itálico (Ctrl+I)"
            >
              I
            </button>
          </div>

          {/* Separador */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Deletar */}
          <button 
            onClick={() => { 
              if(window.confirm('Deletar este balão?')) { 
                saveToHistory();
                onBubbleDelete && onBubbleDelete(activeBubble.id); 
                startEditingBubble(null); 
              }
            }}
            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            title="Deletar balão (Delete)"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
       </div>

       {/* Linha 2: Alinhamento, Escala, Line Height, Rotacao */}
       <div className="flex items-center gap-2 flex-wrap">
          {/* Alinhamento Horizontal */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg border border-slate-700 p-1">
            <span className="text-[9px] text-slate-500 px-1">Alin.</span>
            {(['left', 'center', 'right'] as const).map(align => (
              <button 
                key={align}
                onClick={() => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, textAlign: align }); }}
                className={`p-1 rounded transition-colors ${activeBubble.textAlign === align || (!activeBubble.textAlign && align === 'center') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                title={align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}
              >
                {align === 'left' ? <Bars3BottomLeftIcon className="w-3.5 h-3.5"/> : align === 'center' ? <Bars3Icon className="w-3.5 h-3.5"/> : <Bars3BottomRightIcon className="w-3.5 h-3.5"/>}
              </button>
            ))}
          </div>

          {/* Separador */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Escala */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg border border-slate-700 px-2 py-1">
            <span className="text-[10px] text-slate-500">Escala</span>
            <input 
              type="range" min="0.5" max="1.5" step="0.05"
              value={activeBubble.scale || 1}
              onMouseDown={(e) => e.stopPropagation()}
              onInput={(e) => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, scale: parseFloat((e.target as HTMLInputElement).value) }); }}
              className="w-14 h-1 bg-slate-700 rounded-lg appearance-none accent-indigo-500"
            />
            <span className="text-[10px] text-indigo-400 w-8">{Math.round((activeBubble.scale || 1) * 100)}%</span>
          </div>

          {/* Separador */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Line Height */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg border border-slate-700 px-2 py-1">
            <span className="text-[10px] text-slate-500">Linha</span>
            <input 
              type="range" min="0.8" max="2" step="0.1"
              value={activeBubble.lineHeight || 1.15}
              onMouseDown={(e) => e.stopPropagation()}
              onInput={(e) => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, lineHeight: parseFloat((e.target as HTMLInputElement).value) }); }}
              className="w-12 h-1 bg-slate-700 rounded-lg appearance-none accent-indigo-500"
            />
            <span className="text-[10px] text-indigo-400 w-6">{(activeBubble.lineHeight || 1.15).toFixed(1)}</span>
          </div>

          {/* Separador */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Rotacao */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg border border-slate-700 px-2 py-1">
            <span className="text-[10px] text-slate-500">Rot.</span>
            <input 
              type="range" min="-45" max="45" step="1"
              value={activeBubble.rotation || 0}
              onMouseDown={(e) => e.stopPropagation()}
              onInput={(e) => { saveToHistory(); onBubbleUpdate && onBubbleUpdate({ ...activeBubble, rotation: parseInt((e.target as HTMLInputElement).value) }); }}
              className="w-12 h-1 bg-slate-700 rounded-lg appearance-none accent-indigo-500"
            />
            <span className="text-[10px] text-indigo-400 w-6">{activeBubble.rotation || 0}°</span>
          </div>
       </div>

       {/* Dica */}
       <p className="text-[10px] text-slate-600 mt-2 text-center">
         Tab/Shift+Tab: navegar • Ctrl+B/I: estilo • +/-: fonte • Delete: remover • ESC: fechar
       </p>
    </div>
  );
};

export default ViewerToolbar;
