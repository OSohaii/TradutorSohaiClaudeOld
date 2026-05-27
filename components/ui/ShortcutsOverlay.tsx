import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '← / →', description: 'Navegar entre paginas' },
  { key: 'Space', description: 'Alternar Original / Traduzido' },
  { key: 'F', description: 'Modo tela cheia (clean)' },
  { key: 'Tab / Shift+Tab', description: 'Navegar entre baloes' },
  { key: 'Ctrl+Z', description: 'Desfazer' },
  { key: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Refazer' },
  { key: 'Ctrl+B', description: 'Negrito' },
  { key: 'Ctrl+I', description: 'Italico' },
  { key: '+ / -', description: 'Aumentar / Diminuir fonte' },
  { key: 'Delete', description: 'Remover balao selecionado' },
  { key: 'Ctrl+Shift+C', description: 'Copiar estilo' },
  { key: 'Ctrl+Shift+V', description: 'Colar estilo' },
  { key: 'Esc', description: 'Cancelar / Fechar' },
  { key: '?', description: 'Mostrar este painel' },
];

const ShortcutsOverlay: React.FC<ShortcutsOverlayProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">Atalhos de Teclado</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
            {shortcuts.map((s) => (
              <React.Fragment key={s.key}>
                <kbd className="bg-slate-700 text-slate-200 text-xs font-mono px-2 py-1 rounded border border-slate-600 whitespace-nowrap text-center">
                  {s.key}
                </kbd>
                <span className="text-sm text-slate-300 self-center">{s.description}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsOverlay;
