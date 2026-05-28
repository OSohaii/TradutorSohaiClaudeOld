import React from 'react';
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';

interface StatusBarProps {
  zoom: number;
  setZoom: (val: number | ((prev: number) => number)) => void;
  imageWidth?: number;
  imageHeight?: number;
  bubbleCount: number;
}

const StatusBar: React.FC<StatusBarProps> = ({
  zoom,
  setZoom,
  imageWidth,
  imageHeight,
  bubbleCount,
}) => {
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  return (
    <div className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-[11px] text-slate-400 select-none z-50 relative shrink-0">
      
      {/* Left side: Zoom control */}
      <div className="flex items-center gap-3">
        <span className="font-medium">Zoom</span>
        <div className="flex items-center gap-1.5 w-32">
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="hover:text-white">
            <MagnifyingGlassMinusIcon className="w-3.5 h-3.5" />
          </button>
          
          <input 
            type="range" 
            min="0.1" 
            max="4.0" 
            step="0.05"
            value={zoom}
            onChange={handleZoomChange}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          
          <button onClick={() => setZoom(z => Math.min(4.0, z + 0.1))} className="hover:text-white">
            <MagnifyingGlassPlusIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="w-8 text-right font-mono">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Right side: Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span>{bubbleCount} blocos de texto</span>
        </div>
        
        {imageWidth && imageHeight ? (
          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-4">
            <span>Tela: {imageWidth} &times; {imageHeight}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StatusBar;
