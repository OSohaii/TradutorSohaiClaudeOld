import React from 'react';
import {
  Bars3Icon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import VersionBadge from '../ui/VersionBadge';
import { useSessionStore } from '../../store';

interface TopBarProps {
  onOpenSidebar: () => void;
  readingMode: 'single' | 'strip';
  onToggleReadingMode: () => void;
}

/**
 * Mobile-only top bar (hidden on md+).
 * Shows the sidebar toggle, current file name, and reading-mode toggle.
 */
const TopBar: React.FC<TopBarProps> = ({ onOpenSidebar, readingMode, onToggleReadingMode }) => {
  const currentImage = useSessionStore(s => s.currentImage);

  return (
    <header className="md:hidden h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30 shadow-lg">
      <button onClick={onOpenSidebar} className="p-2 -ml-2 text-slate-300">
        <Bars3Icon className="w-6 h-6" />
      </button>
      <span className="font-semibold text-slate-200 truncate max-w-[150px] flex items-center gap-1.5">
        {currentImage ? currentImage.fileName : 'MangaLens'}
        {!currentImage && <VersionBadge variant="subtle" />}
      </span>
      {currentImage && (
        <button
          onClick={onToggleReadingMode}
          className="p-2 -mr-2 text-indigo-400"
          title={readingMode === 'single' ? 'Modo Página Única' : 'Modo Long Strip'}
        >
          {readingMode === 'single'
            ? <ArrowsPointingOutIcon className="w-5 h-5" />
            : <ArrowsPointingInIcon className="w-5 h-5" />}
        </button>
      )}
    </header>
  );
};

export default TopBar;
