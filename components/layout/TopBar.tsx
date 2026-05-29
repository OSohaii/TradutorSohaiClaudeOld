import React from 'react';
import {
  Bars3Icon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog8ToothIcon,
} from '@heroicons/react/24/outline';
import VersionBadge from '../ui/VersionBadge';
import { useSessionStore } from '../../store';

interface TopBarProps {
  onOpenSidebar: () => void;
  onOpenRightSidebar: () => void;
  readingMode: 'single' | 'strip';
  onToggleReadingMode: () => void;
}

/**
 * Mobile-only top bar (hidden on md+).
 * Shows the sidebar toggle, current file name, reading-mode toggle, and settings panel toggle.
 */
const TopBar: React.FC<TopBarProps> = ({
  onOpenSidebar,
  onOpenRightSidebar,
  readingMode,
  onToggleReadingMode,
}) => {
  const currentImage = useSessionStore(s => s.currentImage);

  return (
    <header className="md:hidden h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30 shadow-lg">
      <button onClick={onOpenSidebar} className="p-2 -ml-2 text-slate-300 hover:text-white transition-colors" title="Menu Lateral Esquerdo">
        <Bars3Icon className="w-6 h-6" />
      </button>
      <span className="font-semibold text-slate-200 truncate max-w-[150px] flex items-center gap-1.5">
        {currentImage ? currentImage.fileName : 'MangaLens'}
        {!currentImage && <VersionBadge variant="subtle" />}
      </span>
      <div className="flex items-center gap-2">
        {currentImage && (
          <button
            onClick={onToggleReadingMode}
            className="p-2 text-slate-300 hover:text-white transition-colors"
            title={readingMode === 'single' ? 'Modo Página Única' : 'Modo Long Strip'}
          >
            {readingMode === 'single'
              ? <ArrowsPointingOutIcon className="w-5 h-5" />
              : <ArrowsPointingInIcon className="w-5 h-5" />}
          </button>
        )}
        <button
          onClick={onOpenRightSidebar}
          className="p-2 -mr-2 text-indigo-400 hover:text-indigo-300 transition-colors"
          title="Menu do Usuário"
        >
          <Cog8ToothIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
