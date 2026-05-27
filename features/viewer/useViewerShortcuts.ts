import { useEffect } from 'react';
import { TextBubble } from '../../types';

export interface UseViewerShortcutsParams {
  activeBubble: TextBubble | undefined;
  editingBubbleId: string | null;
  isEditingMode: boolean;
  isAddingBubble: boolean;
  onBubbleUpdate?: (bubble: TextBubble) => void;
  onBubbleDelete?: (bubbleId: string) => void;
  calculatedFontSizes: Record<string, number>;
  copiedStyle: Partial<TextBubble> | null;
  navigateBubble: (direction: 'next' | 'prev') => void;
  copyStyle: () => void;
  pasteStyle: () => void;
  saveToHistory: () => void;
  undoBubbles: () => void;
  redoBubbles: () => void;
  setEditingBubbleId: (id: string | null) => void;
  setIsAddingBubble: (v: boolean) => void;
  setNewBubbleStart: (v: {x: number, y: number} | null) => void;
  onPrev?: () => void;
  onNext?: () => void;
  toggleViewMode?: () => void;
  toggleCleanMode?: () => void;
  setShowShortcuts?: (show: boolean) => void;
}

export function useViewerShortcuts(params: UseViewerShortcutsParams): void {
  const {
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
    toggleCleanMode,
    setShowShortcuts,
  } = params;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName?.toUpperCase() || '';
      const isInInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // ESC - Fechar edicao ou cancelar criacao de balao
      if (e.key === 'Escape') {
        if (isAddingBubble) {
          setIsAddingBubble(false);
          setNewBubbleStart(null);
          return;
        }
        if (editingBubbleId) {
          setEditingBubbleId(null);
          return;
        }
      }

      // ? (Shift+/) - Mostrar atalhos
      if (e.key === '?' && !isInInput) {
        e.preventDefault();
        setShowShortcuts?.(true);
        return;
      }

      // ArrowLeft - Pagina anterior
      if (e.key === 'ArrowLeft' && !isInInput) {
        onPrev?.();
        return;
      }

      // ArrowRight - Proxima pagina
      if (e.key === 'ArrowRight' && !isInInput) {
        onNext?.();
        return;
      }

      // Space - Alternar modo de visualizacao
      if (e.key === ' ' && !isInInput && !editingBubbleId) {
        e.preventDefault();
        toggleViewMode?.();
        return;
      }

      // F - Modo limpo (clean/fullscreen)
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !isInInput && !editingBubbleId) {
        toggleCleanMode?.();
        return;
      }

      // Atalhos que funcionam quando um balao esta selecionado
      if (activeBubble && onBubbleUpdate) {
        // Ctrl+B - Negrito
        if (e.ctrlKey && e.key === 'b') {
          e.preventDefault();
          saveToHistory();
          onBubbleUpdate({ 
            ...activeBubble, 
            fontWeight: activeBubble.fontWeight === 'bold' ? 'normal' : 'bold' 
          });
          return;
        }

        // Ctrl+I - Italico
        if (e.ctrlKey && e.key === 'i') {
          e.preventDefault();
          saveToHistory();
          onBubbleUpdate({ 
            ...activeBubble, 
            fontStyle: activeBubble.fontStyle === 'italic' ? 'normal' : 'italic' 
          });
          return;
        }

        // Delete ou Backspace - Deletar balao (quando nao esta editando texto)
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isInInput) {
          e.preventDefault();
          if (onBubbleDelete) {
            saveToHistory();
            onBubbleDelete(activeBubble.id);
            setEditingBubbleId(null);
          }
          return;
        }

        // + ou = - Aumentar fonte
        if ((e.key === '+' || e.key === '=') && !e.ctrlKey) {
          e.preventDefault();
          const currentSize = activeBubble.fontSize || calculatedFontSizes[activeBubble.id] || 14;
          saveToHistory();
          onBubbleUpdate({ ...activeBubble, fontSize: Math.min(currentSize + 2, 120) });
          return;
        }

        // - Diminuir fonte
        if (e.key === '-' && !e.ctrlKey) {
          e.preventDefault();
          const currentSize = activeBubble.fontSize || calculatedFontSizes[activeBubble.id] || 14;
          saveToHistory();
          onBubbleUpdate({ ...activeBubble, fontSize: Math.max(currentSize - 2, 6) });
          return;
        }

        // Ctrl+Shift+C - Copiar estilo
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
          e.preventDefault();
          copyStyle();
          return;
        }

        // Ctrl+Shift+V - Colar estilo
        if (e.ctrlKey && e.shiftKey && e.key === 'V') {
          e.preventDefault();
          pasteStyle();
          return;
        }
      }

      // Tab / Shift+Tab - Navegacao entre baloes (funciona no modo edicao)
      if (e.key === 'Tab' && isEditingMode) {
        e.preventDefault();
        navigateBubble(e.shiftKey ? 'prev' : 'next');
        return;
      }

      // Ctrl+Z - Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoBubbles();
        return;
      }

      // Ctrl+Shift+Z ou Ctrl+Y - Redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        redoBubbles();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingBubbleId, activeBubble, isEditingMode, onBubbleUpdate, onBubbleDelete, calculatedFontSizes, copiedStyle, undoBubbles, redoBubbles, onPrev, onNext, toggleViewMode, toggleCleanMode, setShowShortcuts, isAddingBubble]);
}
