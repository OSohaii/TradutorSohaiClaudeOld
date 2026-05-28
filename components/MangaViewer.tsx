
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ProcessedImage, ViewMode, TextBubble } from '../types';
import BubbleOverlay from './BubbleOverlay';
import ViewerToolbar from './ViewerToolbar';
import ComparisonSlider from './ComparisonSlider';
import DesktopTopBar from './layout/DesktopTopBar';
import StatusBar from './layout/StatusBar';
import ShortcutsOverlay from './ui/ShortcutsOverlay';
import { useSessionStore } from '../store';
import { useViewerShortcuts } from '../features/viewer/useViewerShortcuts';
import { useSwipeNavigation } from '../features/viewer/useSwipeNavigation';
import { usePinchZoom } from '../features/viewer/usePinchZoom';
import { downloadCanvas } from '../features/viewer/downloadCanvas';
import { 
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface MangaViewerProps {
  image: ProcessedImage;
  onNext?: () => void;
  onPrev?: () => void;
  onBubbleUpdate?: (bubble: TextBubble) => void;
  onBubbleDelete?: (bubbleId: string) => void;
  onBubbleAdd?: (bubble: TextBubble) => void;
  onImageUpdate?: (image: ProcessedImage) => void;
  onToggleStrip?: () => void;
  onToggleCleanMode?: () => void;
  onRetry?: () => void;
  onConfirmTranslate?: () => void;
  onCancelOcr?: () => void;
  stripMode?: boolean;
  isCleanMode?: boolean;
  showOriginalText?: boolean;
  defaultFont?: string;
  globalBold?: boolean;
  globalItalic?: boolean;
  globalBubbleScale?: number;
  customFonts?: FontOption[];
  totalPages?: number;
  currentPageIndex?: number;
  costLabel?: string;
}

export type FontOption = { name: string; value: string; type?: 'font' };
export type FontGroup = { group: string; options: FontOption[]; type: 'group' };

export const AVAILABLE_FONTS: (FontOption | FontGroup)[] = [
  { name: 'CC Wild Words (BR)', value: '"CC Wild Words Roman BR", "CC Wild Words", "Comic Sans MS", sans-serif' },
  {
    group: 'Clássicos do Mangá',
    type: 'group',
    options: [
      { name: 'Anime Ace', value: '"Anime Ace", sans-serif' },
      { name: 'Anime Ace 2.0 BB', value: '"Anime Ace 2.0 BB", sans-serif' },
      { name: 'Manga Temple', value: '"Manga Temple", sans-serif' },
      { name: 'Komika Axis', value: '"Komika Axis", sans-serif' },
    ]
  },
  {
    group: 'Diálogos Manga',
    type: 'group',
    options: [
        { name: 'Comic Neue', value: '"Comic Neue", "Comic Sans MS", sans-serif' },
        { name: 'Kalam', value: '"Kalam", "Coming Soon", cursive' },
        { name: 'Architects Daughter', value: '"Architects Daughter", cursive' },
    ]
  },
  {
    group: 'SFX & Pincel',
    type: 'group',
    options: [
        { name: 'Permanent Marker', value: '"Permanent Marker", display' },
        { name: 'Bangers', value: '"Bangers", display' },
    ]
  },
  { name: 'Comic (Padrão)', value: '"Comic Sans MS", sans-serif' },
];

export const DEFAULT_FONT_VALUE = (AVAILABLE_FONTS[0] as FontOption).value;

const MangaViewer: React.FC<MangaViewerProps> = ({ 
  image, 
  onNext, 
  onPrev,
  onBubbleUpdate,
  onBubbleDelete,
  onBubbleAdd,
  onImageUpdate,
  onToggleStrip,
  onToggleCleanMode,
  onRetry,
  onConfirmTranslate,
  onCancelOcr,
  stripMode = false,
  isCleanMode = false,
  showOriginalText = false,
  defaultFont,
  globalBold = true,
  globalItalic = false,
  globalBubbleScale = 1.0,
  customFonts = [],
  totalPages = 1,
  currentPageIndex = 0,
  costLabel,
}) => {
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TRANSLATED);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isAddingBubble, setIsAddingBubble] = useState(false);
  const [newBubbleStart, setNewBubbleStart] = useState<{x: number, y: number} | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const [hideBubbleBorders, setHideBubbleBorders] = useState(true);
  const [isBubbleTransparent, setIsBubbleTransparent] = useState(false);
  const [showTextStroke, setShowTextStroke] = useState(true);
  
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [paintColor, setPaintColor] = useState('#FFFFFF');
  
  // Inline Edit State
  const [editingBubbleId, setEditingBubbleId] = useState<string | null>(null);
  const [calculatedFontSizes, setCalculatedFontSizes] = useState<Record<string, number>>({});

  // Bubble undo/redo lives in the session store now (B8/B9 fix in
  // PR #8). The viewer reads `canUndo`/`canRedo` reactively and calls
  // `pushSnapshot()` before each mutation. Pre-PR #8 history was
  // local `useState<TextBubble[][]>`, snapshotting only the bubbles
  // array; undo applied via per-bubble `onBubbleUpdate`, which silently
  // skipped adds and deletes. The store now snapshots the full bubbles
  // array per image and `undoBubbles` replaces it wholesale, so adds
  // and deletes are reversible.
  const pushSnapshot = useSessionStore(s => s.pushBubbleSnapshot);
  const undoBubbles = useSessionStore(s => s.undoBubbles);
  const redoBubbles = useSessionStore(s => s.redoBubbles);
  const canUndo = useSessionStore(s => {
    const cur = s.currentImage;
    if (!cur || cur.id !== image.id) return false;
    const entry = s.bubbleHistory[image.id];
    return !!entry && entry.index > 0;
  });
  const canRedo = useSessionStore(s => {
    const cur = s.currentImage;
    if (!cur || cur.id !== image.id) return false;
    const entry = s.bubbleHistory[image.id];
    return !!entry && entry.index < entry.snapshots.length - 1;
  });

  const [copiedStyle, setCopiedStyle] = useState<Partial<TextBubble> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isDrawing = useRef(false);

  // Image dimensions stored in state so they can be read safely during render.
  // Updated via the <img> onLoad callback below.
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Page indicator state (shows briefly after navigation)
  const [showPageIndicator, setShowPageIndicator] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const pageIndicatorTimer = useRef<number | null>(null);

  // Swipe navigation hook
  const swipeEnabled = !stripMode && !isEditingMode && !isPaintMode && !isAddingBubble && !editingBubbleId;
  useSwipeNavigation({
    containerRef,
    onNext: onNext,
    onPrev: onPrev,
    enabled: swipeEnabled,
    onSwipe: (direction) => {
      setSwipeDirection(direction);
      setShowPageIndicator(true);
      if (pageIndicatorTimer.current) clearTimeout(pageIndicatorTimer.current);
      pageIndicatorTimer.current = window.setTimeout(() => {
        setShowPageIndicator(false);
        setSwipeDirection(null);
      }, 2000);
    },
  });

  // Clear any pending page-indicator timer when the viewer unmounts. Without
  // this, fast page navigation could fire setShowPageIndicator(false) on an
  // unmounted component (React warning) and leave dangling browser timers.
  useEffect(() => {
    return () => {
      if (pageIndicatorTimer.current) {
        clearTimeout(pageIndicatorTimer.current);
        pageIndicatorTimer.current = null;
      }
    };
  }, []);

  // Pinch-to-zoom hook
  usePinchZoom({
    containerRef,
    zoom,
    setZoom,
    enabled: !stripMode,
  });

  const isFullServerResult = !!image.translatedImageUrl && image.bubbles.length === 0;
  const hasOverlays = image.bubbles.length > 0;
  const isOcrDone = image.status === 'ocr-done';
  const activeImageUrl = (viewMode === ViewMode.TRANSLATED && image.translatedImageUrl) ? image.translatedImageUrl : image.imageUrl;

  const allFonts = useMemo(() => {
    if (customFonts.length === 0) return AVAILABLE_FONTS;
    return [...customFonts, ...AVAILABLE_FONTS];
  }, [customFonts]);

  const activeBubble = useMemo(() => 
    image.bubbles.find(b => b.id === editingBubbleId), 
  [image.bubbles, editingBubbleId]);

  // Índice do balão atual para navegação
  const currentBubbleIndex = useMemo(() => 
    image.bubbles.findIndex(b => b.id === editingBubbleId),
  [image.bubbles, editingBubbleId]);

  // Navegação entre balões
  const navigateBubble = (direction: 'next' | 'prev') => {
    if (image.bubbles.length === 0) return;
    
    let newIndex: number;
    if (currentBubbleIndex === -1) {
      newIndex = direction === 'next' ? 0 : image.bubbles.length - 1;
    } else {
      newIndex = direction === 'next' 
        ? (currentBubbleIndex + 1) % image.bubbles.length
        : (currentBubbleIndex - 1 + image.bubbles.length) % image.bubbles.length;
    }
    setEditingBubbleId(image.bubbles[newIndex].id);
  };

  // Salvar estado para undo (delegado ao store; preserva o nome local
  // para minimizar churn nos call sites do toolbar).
  const saveToHistory = () => {
    pushSnapshot();
  };

  // Undo / Redo: thin wrappers ao redor do store (que substitui
  // `image.bubbles` por completo, então add/delete são reversíveis).
  const handleUndo = () => {
    undoBubbles();
  };

  const handleRedo = () => {
    redoBubbles();
  };

  // Copiar estilo do balão atual
  const copyStyle = () => {
    if (activeBubble) {
      setCopiedStyle({
        fontFamily: activeBubble.fontFamily,
        fontSize: activeBubble.fontSize,
        fontWeight: activeBubble.fontWeight,
        fontStyle: activeBubble.fontStyle,
        textAlign: activeBubble.textAlign,
        color: activeBubble.color,
        scale: activeBubble.scale,
        lineHeight: activeBubble.lineHeight,
      });
    }
  };

  // Colar estilo no balão atual
  const pasteStyle = () => {
    if (activeBubble && copiedStyle && onBubbleUpdate) {
      saveToHistory();
      onBubbleUpdate({ ...activeBubble, ...copiedStyle });
    }
  };

  // Keyboard shortcuts (extracted to custom hook)
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === ViewMode.ORIGINAL ? ViewMode.TRANSLATED : ViewMode.ORIGINAL));
  }, []);

  useViewerShortcuts({
    activeBubble,
    editingBubbleId,
    isEditingMode,
    isAddingBubble,
    onBubbleUpdate,
    onBubbleDelete,
    calculatedFontSizes,
    copiedStyle,
    navigateBubble,
    copyStyle,
    pasteStyle,
    saveToHistory,
    undoBubbles,
    redoBubbles,
    setEditingBubbleId,
    setIsAddingBubble,
    setNewBubbleStart,
    onPrev,
    onNext,
    toggleViewMode,
    toggleCleanMode: onToggleCleanMode,
    setShowShortcuts,
  });

  useEffect(() => {
    setZoom(1);
    setIsEditingMode(isOcrDone); 
    setIsPaintMode(false);
    setEditingBubbleId(null);
  }, [image.id, isOcrDone]);

  useEffect(() => {
    if (isFullServerResult || stripMode) return; 
    const canvas = canvasRef.current;
    const img = imgRef.current;
    
    if (canvas && img && image.status === 'done') {
      const initCanvas = () => {
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
             canvas.width = img.naturalWidth;
             canvas.height = img.naturalHeight;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (image.maskDataUrl) {
            const maskImg = new Image();
            // addEventListener instead of .onload= so other listeners
            // (e.g. set by useSwipeNavigation or future React refs) are
            // preserved. { once: true } also auto-cleans the listener.
            maskImg.addEventListener(
              'load',
              () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(maskImg, 0, 0);
              },
              { once: true },
            );
            maskImg.src = image.maskDataUrl;
          } else {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      };
      if (img.complete) {
        initCanvas();
      } else {
        // addEventListener (vs img.onload =) avoids stomping on any other
        // load handler that React or another effect may have attached to
        // the same <img>. The cleanup below ensures we don't double-fire
        // when the effect re-runs (e.g. when image.maskDataUrl changes
        // before the previous load completed).
        img.addEventListener('load', initCanvas, { once: true });
        return () => {
          img.removeEventListener('load', initCanvas);
        };
      }
    }
  }, [image.id, image.status, image.maskDataUrl, isFullServerResult, stripMode]);

  const startEditingBubble = (bubble: TextBubble | null) => {
    setEditingBubbleId(bubble ? bubble.id : null);
  };

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintMode) return;
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
       const { x, y } = getCoords(e);
       ctx.beginPath(); ctx.moveTo(x, y); ctx.strokeStyle = paintColor; ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.lineTo(x, y); ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintMode || !isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { const { x, y } = getCoords(e); ctx.lineTo(x, y); ctx.stroke(); }
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.closePath();
      if (canvasRef.current && onImageUpdate) onImageUpdate({ ...image, maskDataUrl: canvasRef.current.toDataURL() });
    }
  };

  // Funções para criar novo balão
  const handleAddBubbleStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingBubble) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    
    setNewBubbleStart({ x, y });
  };

  const handleAddBubbleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Podemos adicionar preview visual aqui se necessário
  };

  const handleAddBubbleEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingBubble || !newBubbleStart || !onBubbleAdd) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const endX = ((e.clientX - rect.left) / rect.width) * 1000;
    const endY = ((e.clientY - rect.top) / rect.height) * 1000;
    
    // Verificar tamanho mínimo
    const minSize = 30;
    const width = Math.abs(endX - newBubbleStart.x);
    const height = Math.abs(endY - newBubbleStart.y);
    
    if (width < minSize || height < minSize) {
      // Criar balão padrão se área muito pequena
      const newBubble: TextBubble = {
        id: `bubble-${Date.now()}`,
        originalText: '',
        translatedText: 'Texto aqui',
        box: {
          xmin: Math.max(0, newBubbleStart.x - 50),
          ymin: Math.max(0, newBubbleStart.y - 30),
          xmax: Math.min(1000, newBubbleStart.x + 50),
          ymax: Math.min(1000, newBubbleStart.y + 30),
        },
        type: 'dialogue'
      };
      saveToHistory();
      onBubbleAdd(newBubble);
      setEditingBubbleId(newBubble.id);
    } else {
      // Criar balão com área desenhada
      const newBubble: TextBubble = {
        id: `bubble-${Date.now()}`,
        originalText: '',
        translatedText: 'Texto aqui',
        box: {
          xmin: Math.min(newBubbleStart.x, endX),
          ymin: Math.min(newBubbleStart.y, endY),
          xmax: Math.max(newBubbleStart.x, endX),
          ymax: Math.max(newBubbleStart.y, endY),
        },
        type: 'dialogue'
      };
      saveToHistory();
      onBubbleAdd(newBubble);
      setEditingBubbleId(newBubble.id);
    }
    
    setIsAddingBubble(false);
    setNewBubbleStart(null);
    setIsEditingMode(true);
  };

  const handleDownload = async () => {
    if (!imgRef.current) return;
    await downloadCanvas({
      image,
      imgElement: imgRef.current,
      canvasElement: canvasRef.current,
      defaultFont,
      globalBold,
      globalItalic,
      globalBubbleScale,
      isBubbleTransparent,
      showTextStroke,
      calculatedFontSizes,
    });
  };

  return (
    <div className={`flex flex-col h-full ${stripMode ? '' : 'bg-slate-900 rounded-lg border border-slate-700 shadow-2xl overflow-hidden'} relative`}>
      
      {!stripMode && !isCleanMode && (
        <DesktopTopBar
          onPrev={onPrev}
          onNext={onNext}
          imageStatus={image.status}
          isFullServerResult={isFullServerResult}
          hasOverlays={hasOverlays}
          isOcrDone={isOcrDone}
          handleDownload={handleDownload}
          setShowComparison={setShowComparison}
          isPaintMode={isPaintMode}
          setIsPaintMode={setIsPaintMode}
          isEditingMode={isEditingMode}
          setIsEditingMode={setIsEditingMode}
          isAddingBubble={isAddingBubble}
          setIsAddingBubble={setIsAddingBubble}
          hideBubbleBorders={hideBubbleBorders}
          setHideBubbleBorders={setHideBubbleBorders}
          isBubbleTransparent={isBubbleTransparent}
          setIsBubbleTransparent={setIsBubbleTransparent}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onConfirmTranslate={onConfirmTranslate}
          onCancelOcr={onCancelOcr}
        />
      )}

      <div 
        ref={containerRef}
        className={`flex-1 relative bg-slate-950 ${stripMode ? '' : 'overflow-auto flex justify-center items-start p-4 scrollbar-hide'}`}
      >
        {/* Overlay para capturar cliques fora - fecha edição */}
        {editingBubbleId && (
          <div 
            className="absolute inset-0 z-[15]" 
            onClick={() => setEditingBubbleId(null)}
          />
        )}
        
        <div 
          className={`relative transition-transform duration-200 ease-out origin-top z-[20] ${swipeDirection === 'left' ? 'animate-slide-left' : swipeDirection === 'right' ? 'animate-slide-right' : ''}`}
          style={{ 
            width: stripMode ? '100%' : (image.status === 'done' ? 'auto' : '100%'), 
            maxWidth: stripMode ? '100%' : '1200px',
            transform: stripMode ? 'none' : `scale(${zoom})`,
          }}
        >
          <img 
            ref={imgRef}
            src={activeImageUrl} 
            alt="Manga Page" 
            className="w-full h-auto shadow-2xl select-none"
            style={{ display: 'block' }}
            onClick={() => editingBubbleId && setEditingBubbleId(null)}
            onLoad={(e) => {
              const el = e.currentTarget;
              setImageDimensions({ width: el.naturalWidth, height: el.naturalHeight });
            }}
          />

          {/* Error overlay */}
          {image.status === 'error' && (
            <div className="absolute inset-0 z-40 bg-slate-900/80 flex flex-col items-center justify-center gap-4 p-6">
              <ExclamationTriangleIcon className="w-12 h-12 text-red-400" />
              <p className="text-sm text-red-300 text-center max-w-xs">
                {image.errorMessage || 'Erro na traducao'}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Tentar Novamente
                </button>
              )}
            </div>
          )}

          {/* Overlay para adicionar novo balão */}
          {isAddingBubble && (image.status === 'done' || isOcrDone) && (
            <div 
              className="absolute inset-0 z-30 cursor-crosshair"
              onMouseDown={handleAddBubbleStart}
              onMouseMove={handleAddBubbleMove}
              onMouseUp={handleAddBubbleEnd}
              style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
            >
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
                Clique para adicionar um balão
              </div>
            </div>
          )}

          {image.status === 'done' && !isFullServerResult && !stripMode && (
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              className={`absolute inset-0 z-10 w-full h-full ${isPaintMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
            />
          )}

          {(image.status === 'done' || isOcrDone) && hasOverlays && (
            <div 
              className={`absolute inset-0 w-full h-full z-20 ${isPaintMode ? 'pointer-events-none opacity-40' : ''}`}
              onClick={(e) => {
                // Fecha edição se clicou no container (não em um balão)
                if (e.target === e.currentTarget && editingBubbleId) {
                  setEditingBubbleId(null);
                }
              }}
            >
              {image.bubbles.map(bubble => {
                const isVisible = (viewMode === ViewMode.TRANSLATED) || isEditingMode || isOcrDone;
                if (!isVisible) return null;

                return (
                  <BubbleOverlay 
                    key={bubble.id} 
                    bubble={bubble} 
                    isEditing={isEditingMode && !stripMode} 
                    activeEditingId={editingBubbleId}
                    hideBorder={hideBubbleBorders}
                    isTransparent={isBubbleTransparent}
                    showOriginalText={showOriginalText || isOcrDone}
                    onUpdate={onBubbleUpdate}
                    onEditStart={startEditingBubble}
                    onDelete={onBubbleDelete}
                    defaultFont={defaultFont}
                    enableTextStroke={showTextStroke}
                    globalBold={globalBold}
                    globalItalic={globalItalic}
                    globalBubbleScale={globalBubbleScale}
                    onFontSizeCalculated={(size) => setCalculatedFontSizes(prev => ({...prev, [bubble.id]: size}))}
                    fontSizeCalculatedValue={calculatedFontSizes[bubble.id]}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Unified Toolbar */}
      {activeBubble && (
        <ViewerToolbar
          activeBubble={activeBubble}
          currentBubbleIndex={currentBubbleIndex}
          totalBubbles={image.bubbles.length}
          calculatedFontSizes={calculatedFontSizes}
          defaultFont={defaultFont}
          allFonts={allFonts}
          copiedStyle={copiedStyle}
          canUndo={canUndo}
          canRedo={canRedo}
          navigateBubble={navigateBubble}
          copyStyle={copyStyle}
          pasteStyle={pasteStyle}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          saveToHistory={saveToHistory}
          onBubbleUpdate={onBubbleUpdate}
          onBubbleDelete={onBubbleDelete}
          startEditingBubble={startEditingBubble}
        />
      )}

      {/* Comparison Slider Overlay */}
      {showComparison && image.status === 'done' && (
        <ComparisonSlider
          originalImageUrl={image.imageUrl}
          translatedImageUrl={image.translatedImageUrl}
          image={image}
          onClose={() => setShowComparison(false)}
          defaultFont={defaultFont}
          globalBold={globalBold}
          globalItalic={globalItalic}
          globalBubbleScale={globalBubbleScale}
        />
      )}

      {/* Shortcuts Overlay */}
      <ShortcutsOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Page Indicator (shows on swipe/tap navigation) */}
      {showPageIndicator && totalPages > 1 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none animate-fade-indicator">
          <div className="bg-black/70 backdrop-blur text-white text-lg font-bold px-5 py-3 rounded-xl shadow-lg">
            {currentPageIndex + 1} / {totalPages}
          </div>
        </div>
      )}

      {/* Clean Mode Tap Zones */}
      {isCleanMode && !stripMode && (
        <div className="absolute inset-0 z-[55] flex">
          {/* Left 20% - previous page */}
          <div
            className="w-[20%] h-full cursor-pointer"
            onClick={() => {
              onPrev?.();
              setShowPageIndicator(true);
              if (pageIndicatorTimer.current) clearTimeout(pageIndicatorTimer.current);
              pageIndicatorTimer.current = window.setTimeout(() => setShowPageIndicator(false), 1500);
            }}
          />
          {/* Center 60% - toggle UI */}
          <div
            className="w-[60%] h-full cursor-pointer"
            onClick={() => onToggleCleanMode?.()}
          />
          {/* Right 20% - next page */}
          <div
            className="w-[20%] h-full cursor-pointer"
            onClick={() => {
              onNext?.();
              setShowPageIndicator(true);
              if (pageIndicatorTimer.current) clearTimeout(pageIndicatorTimer.current);
              pageIndicatorTimer.current = window.setTimeout(() => setShowPageIndicator(false), 1500);
            }}
          />
        </div>
      )}

      {/* Cost label for OCR review */}
      {costLabel && isOcrDone && !stripMode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 text-xs text-slate-300 bg-slate-800/80 backdrop-blur px-2 py-1 rounded">
          {costLabel}
        </div>
      )}

      {/* StatusBar */}
      {!stripMode && !isCleanMode && (
        <StatusBar
          zoom={zoom}
          setZoom={setZoom}
          imageWidth={imageDimensions?.width}
          imageHeight={imageDimensions?.height}
          bubbleCount={image.bubbles.length}
        />
      )}
    </div>
  );
};

export default MangaViewer;
