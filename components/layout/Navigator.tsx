import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowPathIcon,
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PlayIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

import VersionBadge from '../ui/VersionBadge';
import { estimateCost } from '../../features/translator/costEstimation';
import {
  useSessionStore,
  useTranslatorStore,
  EngineId,
} from '../../store';

interface NavigatorProps {
  /** Translation pipeline handlers (owned by App via useTranslatePipeline). */
  handleTranslateAll: () => Promise<void> | void;
  handleTranslateImage: (id: string) => Promise<void> | void;
  handleTranslateOnly: (id: string) => Promise<void> | void;
  handleCancelOcr: (id: string) => void;
  retryImage: (id: string) => Promise<void> | void;

  /** Total token + cost shown in the header badge. */
  totalCost: number;
  displayedTotalTokens: number;

  /**
   * Called when the user picks a page in the list. Used by the mobile
   * drawer to close itself after navigation; on desktop it can be a noop.
   */
  onPagePicked?: () => void;
}

/**
 * Navigator panel: header with branding/token usage + virtualized list of
 * page thumbnails. Lives in the left resizable panel on desktop and inside
 * the mobile drawer. Replaces the "history list" portion of the legacy
 * Sidebar — the engine/style/library/settings controls live elsewhere.
 *
 * Virtualization (`@tanstack/react-virtual`) keeps render cost bounded for
 * chapters with dozens or hundreds of pages.
 */
const Navigator: React.FC<NavigatorProps> = ({
  handleTranslateAll,
  handleTranslateImage,
  handleTranslateOnly,
  handleCancelOcr,
  retryImage,
  totalCost,
  displayedTotalTokens,
  onPagePicked,
}) => {
  const currentImage = useSessionStore(s => s.currentImage);
  const history = useSessionStore(s => s.history);
  const setCurrentImage = useSessionStore(s => s.setCurrentImage);
  const removeImage = useSessionStore(s => s.removeImage);

  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const transEngine = useTranslatorStore(s => s.transEngine);
  const autoTranslate = useTranslatorStore(s => s.autoTranslate);

  const hasIdleItems = history.some(item => item.status === 'idle');
  const idleCount = history.filter(item => item.status === 'idle').length;

  // One-shot shake animation for items that just hit "error" — same as the
  // legacy Sidebar implementation.
  const [shakenItems, setShakenItems] = useState<Set<string>>(new Set());
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

  // Virtualization scaffolding. Row height is fixed (64px) so estimateSize
  // is constant; this lets the list scroll smoothly even with hundreds of
  // pages. The scroll container itself is the second flex child below.
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: history.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 6,
  });

  const handleSelect = (item: typeof history[number]) => {
    setCurrentImage(item);
    onPagePicked?.();
  };

  return (
    <div className="h-full w-full bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
          <BookOpenIcon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-base leading-none tracking-tight">MangaLens</h1>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <VersionBadge />
            {/* Token Usage Badge */}
            <div className={`flex items-center gap-1 border rounded-md px-1.5 py-0.5 ${displayedTotalTokens > 0 ? 'bg-emerald-900/40 border-emerald-500/30' : 'bg-slate-800/40 border-slate-700/50'}`}>
              <span className={`text-[9px] font-mono font-bold ${displayedTotalTokens > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {displayedTotalTokens > 1000 ? `${(displayedTotalTokens / 1000).toFixed(1)}k` : displayedTotalTokens} Tk
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

      {/* "Traduzir Todas" CTA when there are pending pages. Lives outside
          the virtualized list because it's a single non-row element. */}
      {hasIdleItems && (
        <div className="px-3 pt-3 pb-1 space-y-1">
          <button
            onClick={() => void handleTranslateAll()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlayIcon className="w-4 h-4" />
            Traduzir Todas
          </button>
          {!autoTranslate && (
            <p className="text-[10px] text-slate-500 text-center">
              ~${estimateCost(ocrEngine as EngineId, transEngine as EngineId, idleCount).toFixed(3)} estimado
            </p>
          )}
        </div>
      )}

      {/* Virtualized history list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600 space-y-2">
            <DocumentDuplicateIcon className="w-8 h-8 opacity-50" />
            <span className="text-xs">Sem historico recente</span>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const item = history[virtualRow.index];
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-0.5 py-1"
                >
                  <div
                    onClick={() => handleSelect(item)}
                    className={`
                      group flex items-center p-2 rounded-xl cursor-pointer transition-all border h-full
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
                    {/* Thumbnail with status overlay */}
                    <div className={`relative h-10 w-10 rounded-lg bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-800 ${item.status === 'processing' ? 'ring-2 ring-indigo-500 animate-pulse' : ''}`}>
                      <img src={item.imageUrl} className="h-full w-full object-cover" loading="lazy" />
                      {item.status === 'processing' && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
                      {item.status === 'done' && (
                        <div className="absolute -top-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 animate-scale-in">
                          <CheckIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Title + status + index */}
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            item.status === 'done' ? 'bg-green-500' :
                            item.status === 'processing' ? 'bg-blue-500' :
                            item.status === 'error' ? 'bg-red-500' :
                            item.status === 'ocr-done' ? 'bg-orange-500' :
                            'bg-slate-500'
                          }`} />
                          <p className="text-xs font-semibold text-slate-200 truncate">{item.fileName}</p>
                        </div>
                        <span className="text-[9px] text-slate-500 flex-shrink-0 ml-1">#{virtualRow.index + 1}</span>
                      </div>
                      <p className={`text-[10px] truncate ${
                        item.status === 'error' ? 'text-red-400' :
                        item.status === 'idle' ? 'text-indigo-400' :
                        item.status === 'ocr-done' ? 'text-amber-400' :
                        'text-slate-500'
                      }`}>
                        {item.status === 'processing' ? 'Traduzindo...' :
                         item.status === 'done' ? 'Concluido' :
                         item.status === 'idle' ? 'Pendente' :
                         item.status === 'ocr-done' ? 'OCR Pronto' : 'Falha'}
                      </p>
                    </div>

                    {/* Per-item action buttons (visible on hover) */}
                    <div className="flex items-center flex-shrink-0">
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
                        onClick={(e) => { e.stopPropagation(); removeImage(item.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                        title="Remover"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Navigator;
