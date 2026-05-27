import React from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

/**
 * Full-screen overlay shown while the user is dragging files over the window.
 * Purely presentational. The parent owns the visibility state.
 */
const DragDropOverlay: React.FC = () => (
  <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center">
    <div className="border-2 border-dashed border-indigo-400 rounded-2xl p-12 flex flex-col items-center gap-4 animate-drag-pulse">
      <ArrowUpTrayIcon className="w-16 h-16 text-indigo-400" />
      <p className="text-xl font-bold text-white">Solte aqui para traduzir</p>
      <p className="text-sm text-slate-400">Arraste imagens de manga para iniciar</p>
    </div>
  </div>
);

export default DragDropOverlay;
