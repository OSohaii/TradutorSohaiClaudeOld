
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ProcessedImage } from '../types';
import BubbleOverlay from './BubbleOverlay';
import { XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

interface ComparisonSliderProps {
  originalImageUrl: string;
  translatedImageUrl?: string;
  image: ProcessedImage;
  onClose: () => void;
  defaultFont?: string;
  globalBold?: boolean;
  globalItalic?: boolean;
  globalBubbleScale?: number;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalImageUrl,
  translatedImageUrl,
  image,
  onClose,
  defaultFont,
  globalBold,
  globalItalic,
  globalBubbleScale = 1.0,
}) => {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPositionFromEvent = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return 50;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    return Math.min(95, Math.max(5, percent));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition(getPositionFromEvent(e.clientX));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        setPosition(getPositionFromEvent(e.touches[0].clientX));
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, getPositionFromEvent]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderRightSide = () => {
    if (translatedImageUrl) {
      return (
        <img
          src={translatedImageUrl}
          alt="Traduzido"
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      );
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="relative">
          <img
            src={originalImageUrl}
            alt="Traduzido"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
          <div className="absolute inset-0">
            {image.bubbles.map(bubble => (
              <BubbleOverlay
                key={bubble.id}
                bubble={bubble}
                defaultFont={defaultFont}
                globalBold={globalBold}
                globalItalic={globalItalic}
                globalBubbleScale={globalBubbleScale}
                hideBorder={true}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center select-none">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[60] p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors"
        title="Fechar"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Main comparison container */}
      <div
        ref={containerRef}
        className="relative w-full h-full max-w-[90vw] max-h-[90vh] flex items-center justify-center"
      >
        {/* Left side - Original */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={originalImageUrl}
            alt="Original"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>

        {/* Right side - Translated */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        >
          {renderRightSide()}
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-[55] pointer-events-none"
          style={{ left: `${position}%` }}
        />

        {/* Drag handle */}
        <div
          className="absolute z-[56] cursor-ew-resize"
          style={{ left: `${position}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="w-9 h-9 rounded-full bg-white/90 border-2 border-indigo-500 shadow-lg flex items-center justify-center">
            <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        {/* Labels */}
        <div
          className="absolute top-4 left-4 z-[55] px-2 py-1 bg-black/60 text-white text-xs font-medium rounded"
          style={{ display: position > 10 ? 'block' : 'none' }}
        >
          Original
        </div>
        <div
          className="absolute top-4 right-4 z-[55] px-2 py-1 bg-black/60 text-white text-xs font-medium rounded"
          style={{ display: position < 90 ? 'block' : 'none' }}
        >
          Traduzido
        </div>
      </div>
    </div>
  );
};

export default ComparisonSlider;
