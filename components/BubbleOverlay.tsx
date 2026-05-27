
import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { TextBubble, BoundingBox } from '../types';
import { PaintBrushIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/solid';

interface BubbleOverlayProps {
  bubble: TextBubble;
  scale?: number;
  isEditing?: boolean;
  isPaintSelectMode?: boolean;
  isPainted?: boolean;
  hideBorder?: boolean;
  isTransparent?: boolean;
  showOriginalText?: boolean;
  onUpdate?: (updatedBubble: TextBubble) => void;
  onEditStart?: (bubble: TextBubble | null) => void;
  onPaintToggle?: (bubbleId: string) => void;
  onDelete?: (bubbleId: string) => void;
  defaultFont?: string;
  enableTextStroke?: boolean;
  globalBold?: boolean;
  globalItalic?: boolean;
  globalBubbleScale?: number;
  onFontSizeCalculated?: (size: number) => void;
  fontSizeCalculatedValue?: number; // Prop adicionada para consistência
  activeEditingId?: string | null;
}

const BubbleOverlay: React.FC<BubbleOverlayProps> = ({ 
  bubble, 
  isEditing, 
  isPaintSelectMode,
  isPainted,
  hideBorder,
  isTransparent,
  showOriginalText,
  onUpdate,
  onEditStart,
  onPaintToggle,
  onDelete,
  defaultFont,
  enableTextStroke,
  globalBold,
  globalItalic,
  globalBubbleScale = 1.0,
  onFontSizeCalculated,
  fontSizeCalculatedValue,
  activeEditingId
}) => {
  const { box, translatedText, originalText, fontFamily, fontSize, fontWeight, fontStyle, textAlign, letterSpacing, type, color, lineHeight, rotation } = bubble;
  const displayText = showOriginalText ? originalText : translatedText;
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [localBox, setLocalBox] = useState<BoundingBox>(box);
  const [isInteracting, setIsInteracting] = useState(false);
  const isCurrentlyEditingText = activeEditingId === bubble.id;
  
  const isSFX = type === 'sfx';
  const effectiveFont = fontFamily || defaultFont || '"Anime Ace 2.0 BB", "Anime Ace", "CC Wild Words", "Comic Neue", "Comic Sans MS", sans-serif';
  const shouldUppercase = effectiveFont.includes("CC Wild Words Roman BR") || effectiveFont.includes("Anime Ace BR");
  const effectiveFontWeight = fontWeight || (globalBold ? 'bold' : 'normal');
  const effectiveFontStyle = fontStyle || (globalItalic ? 'italic' : 'normal');
  const effectiveScale = bubble.scale ?? globalBubbleScale;
  const effectiveColor = color || '#000000';
  const effectiveLineHeight = lineHeight || 1.15;
  const effectiveRotation = rotation || 0;

  useEffect(() => {
    if (!isInteracting) {
      setLocalBox(box);
    }
  }, [box, isInteracting]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isCurrentlyEditingText && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isCurrentlyEditingText]);

  // Scaling Logic
  const origWidth = localBox.xmax - localBox.xmin;
  const origHeight = localBox.ymax - localBox.ymin;
  const centerX = localBox.xmin + (origWidth / 2);
  const centerY = localBox.ymin + (origHeight / 2);

  const scaledWidth = origWidth * effectiveScale;
  const scaledHeight = origHeight * effectiveScale;

  const scaledXmin = centerX - (scaledWidth / 2);
  const scaledYmin = centerY - (scaledHeight / 2);

  const top = scaledYmin / 10;
  const left = scaledXmin / 10;
  const height = scaledHeight / 10;
  const width = scaledWidth / 10;

  // Font auto-sizing logic
  useLayoutEffect(() => {
    if (isPaintSelectMode || isCurrentlyEditingText) return;

    const container = containerRef.current;
    const textSpan = textRef.current;
    if (!container || !textSpan) return;

    if (fontSize) {
      textSpan.style.fontSize = `${fontSize}px`;
      if (onFontSizeCalculated) onFontSizeCalculated(fontSize);
      return;
    }

    const adjustFontSize = () => {
      const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
      const paddingX = 6;
      const paddingY = 4;
      const availWidth = cWidth - paddingX;
      const availHeight = cHeight - paddingY;

      if (availWidth <= 0 || availHeight <= 0) return;

      const minFontSize = 4; 
      const maxFontSize = 120; 
      const charCount = Math.max(displayText.length, 1);
      const estimated = Math.sqrt((availWidth * availHeight * 0.9) / charCount);
      
      let high = Math.min(Math.max(estimated * 2, minFontSize), maxFontSize, availHeight);
      let low = minFontSize;
      let optimal = minFontSize;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        textSpan.style.fontSize = `${mid}px`;
        if (textSpan.scrollHeight <= availHeight && textSpan.scrollWidth <= availWidth + 2) {
          optimal = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      
      textSpan.style.fontSize = `${optimal}px`;
      if (onFontSizeCalculated) onFontSizeCalculated(optimal);
    };

    adjustFontSize();
    const observer = new ResizeObserver(adjustFontSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [translatedText, width, height, effectiveFont, fontSize, effectiveFontWeight, effectiveFontStyle, isPaintSelectMode, defaultFont, isCurrentlyEditingText, showOriginalText]);

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'nw' | 'ne' | 'se' | 'sw') => {
    if (!isEditing || !onUpdate || isPaintSelectMode || isCurrentlyEditingText) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    setIsInteracting(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startBox = { ...localBox };
    const parentEl = containerRef.current?.offsetParent as HTMLElement;
    if (!parentEl) return;
    const parentRect = parentEl.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dX = ((moveEvent.clientX - startX) / parentRect.width) * 1000;
      const dY = ((moveEvent.clientY - startY) / parentRect.height) * 1000;

      let newBox = { ...startBox };
      if (type === 'move') {
        newBox.xmin += dX; newBox.xmax += dX; newBox.ymin += dY; newBox.ymax += dY;
      } else {
        const minSize = 20;
        if (type.includes('w')) newBox.xmin = Math.min(startBox.xmin + dX, startBox.xmax - minSize);
        if (type.includes('e')) newBox.xmax = Math.max(startBox.xmax + dX, startBox.xmin + minSize);
        if (type.includes('n')) newBox.ymin = Math.min(startBox.ymin + dY, startBox.ymax - minSize);
        if (type.includes('s')) newBox.ymax = Math.max(startBox.ymax + dY, startBox.ymin + minSize);
      }
      setLocalBox(newBox);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      const dX = ((upEvent.clientX - startX) / parentRect.width) * 1000;
      const dY = ((upEvent.clientY - startY) / parentRect.height) * 1000;
      
      let finalBox = { ...startBox };
      if (type === 'move') {
        finalBox.xmin += dX; finalBox.xmax += dX; finalBox.ymin += dY; finalBox.ymax += dY;
      } else {
        const minSize = 20;
        if (type.includes('w')) finalBox.xmin = Math.min(startBox.xmin + dX, startBox.xmax - minSize);
        if (type.includes('e')) finalBox.xmax = Math.max(startBox.xmax + dX, startBox.xmin + minSize);
        if (type.includes('n')) finalBox.ymin = Math.min(startBox.ymin + dY, startBox.ymax - minSize);
        if (type.includes('s')) finalBox.ymax = Math.max(startBox.ymax + dY, startBox.ymin + minSize);
      }
      
      onUpdate({ ...bubble, box: finalBox });
      setIsInteracting(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onUpdate) {
      onUpdate({ ...bubble, translatedText: e.target.value });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      if (onEditStart) onEditStart(null); 
    }
  };

  let containerStyle: React.CSSProperties = {
    top: `${top}%`,
    left: `${left}%`,
    width: `${width}%`,
    height: `${height}%`,
    borderRadius: isSFX ? '4px' : '8px',
    transition: isInteracting ? 'none' : 'all 0.15s ease-out',
  };
  
  let content;

  if (isPaintSelectMode) {
    containerStyle = {
      ...containerStyle,
      border: isPainted ? '3px solid #6366f1' : '1px dashed rgba(255,255,255,0.7)',
      backgroundColor: isPainted ? 'rgba(99, 102, 241, 0.4)' : 'rgba(0,0,0,0.2)',
      cursor: 'pointer',
      pointerEvents: 'auto',
    };
    content = isPainted && <PaintBrushIcon className="w-5 h-5 text-white drop-shadow-md" />;
  } else {
    const borderStyle = isEditing 
      ? (isCurrentlyEditingText ? '2px solid #6366f1' : '1px dashed #6366f1') 
      : (isSFX ? 'none' : (hideBorder ? 'none' : '1px solid #94a3b8'));

    const bgColor = isSFX 
      ? 'rgba(0, 0, 0, 0)' 
      : (isTransparent ? 'rgba(255, 255, 255, 0)' : '#ffffff');

    const defaultStroke = isTransparent || isSFX ? '0px 0px 3px white, 0px 0px 3px white' : 'none';
    const strongStroke = '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff';
    const textShadowValue = enableTextStroke ? strongStroke : defaultStroke;

    containerStyle = {
      ...containerStyle,
      border: borderStyle,
      backgroundColor: bgColor,
      cursor: isEditing ? (isCurrentlyEditingText ? 'text' : 'move') : 'auto',
      pointerEvents: isEditing ? 'auto' : 'none',
      zIndex: isCurrentlyEditingText ? 50 : 10,
      boxShadow: isCurrentlyEditingText ? '0 0 0 4000px rgba(0,0,0,0.4)' : (isEditing ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'),
      transform: effectiveRotation ? `rotate(${effectiveRotation}deg)` : undefined,
    };

    if (isCurrentlyEditingText) {
      // Usar o tamanho calculado se não houver tamanho manual definido para evitar pulos visuais
      const currentFontSize = fontSize || fontSizeCalculatedValue || 14;

      content = (
        <textarea
          ref={textareaRef}
          value={translatedText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent border-none outline-none resize-none p-0 flex items-center justify-center scrollbar-hide overflow-hidden"
          style={{
            fontSize: `${currentFontSize}px`,
            fontFamily: effectiveFont,
            fontWeight: effectiveFontWeight,
            fontStyle: effectiveFontStyle,
            textAlign: textAlign || 'center',
            letterSpacing: letterSpacing ? `${letterSpacing}px` : 'normal',
            textTransform: shouldUppercase ? 'uppercase' : 'none',
            lineHeight: effectiveLineHeight.toString(),
            color: effectiveColor,
            display: 'flex',
            alignItems: 'center',
            paddingTop: '2px'
          }}
        />
      );
    } else {
      content = (
        <span 
          id={`bubble-text-${bubble.id}`}
          ref={textRef}
          className="leading-snug select-none break-words w-full"
          style={{ 
            fontSize: fontSize ? `${fontSize}px` : '12px',
            fontFamily: effectiveFont,
            lineHeight: effectiveLineHeight.toString(), 
            fontWeight: effectiveFontWeight,
            fontStyle: effectiveFontStyle,
            textShadow: textShadowValue,
            textTransform: shouldUppercase ? 'uppercase' : 'none',
            textAlign: textAlign || 'center',
            letterSpacing: letterSpacing ? `${letterSpacing}px` : 'normal',
            color: effectiveColor
          }} 
        >
          {displayText}
        </span>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      onClick={(e) => {
        e.stopPropagation();
        if (isPaintSelectMode && onPaintToggle) onPaintToggle(bubble.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isPaintSelectMode && isEditing && onEditStart) onEditStart(bubble);
      }}
      className="absolute flex items-center justify-center p-1 overflow-hidden"
      style={containerStyle}
    >
      {content}

      {/* Resize Handles */}
      {isEditing && !isPaintSelectMode && !isCurrentlyEditingText && (
        <>
          <div className="absolute top-0 left-0 w-4 h-4 bg-white border-2 border-indigo-500 cursor-nw-resize z-20 -ml-2 -mt-2 rounded-full shadow-lg" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
          <div className="absolute top-0 right-0 w-4 h-4 bg-white border-2 border-indigo-500 cursor-ne-resize z-20 -mr-2 -mt-2 rounded-full shadow-lg" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
          <div className="absolute bottom-0 left-0 w-4 h-4 bg-white border-2 border-indigo-500 cursor-sw-resize z-20 -ml-2 -mb-2 rounded-full shadow-lg" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-white border-2 border-indigo-500 cursor-se-resize z-20 -mr-2 -mb-2 rounded-full shadow-lg" onMouseDown={(e) => handleMouseDown(e, 'se')} />
        </>
      )}

      {/* Removido - Menu unificado no MangaViewer */}
    </div>
  );
};

export default BubbleOverlay;
