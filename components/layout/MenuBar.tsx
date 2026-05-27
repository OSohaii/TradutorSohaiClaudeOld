import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { CheckIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * Menu item descriptor.
 *
 * - `separator`: a horizontal divider with no interaction.
 * - `action`: the regular case. `onSelect = undefined` means the item is
 *   visible but disabled (so users can see what's coming without us hiding
 *   the affordance).
 * - `checked`: optional boolean rendered as a checkmark on the left edge,
 *   used for toggle-style items (e.g. "Mostrar Navigator", "Modo limpo").
 */
export type MenuItem =
  | { type: 'separator' }
  | {
      type?: 'action';
      label: string;
      shortcut?: string;
      onSelect?: () => void;
      checked?: boolean;
    };

interface MenuDef {
  /** Top-level button label (e.g. "Arquivo"). */
  label: string;
  items: MenuItem[];
}

interface MenuBarProps {
  menus: MenuDef[];
  /**
   * Tailwind classes appended to the root element. Used by App.tsx to hide
   * the MenuBar on mobile (`hidden md:flex`).
   */
  className?: string;
}

/**
 * Lightweight desktop-style menu bar with dropdown menus.
 *
 * The component is intentionally self-contained and dependency-free: no
 * Radix, no Headless UI. It implements the subset of menu behaviour we
 * actually use:
 *
 * - Click a top-level button to open its dropdown.
 * - Hovering another top-level button while one is open switches to it
 *   (matches every desktop menu bar in existence).
 * - `Escape`, an outside click, or selecting an item closes the dropdown.
 * - Disabled items (no `onSelect`) render dimmed and ignore clicks.
 * - `checked` items show a checkmark on the left.
 * - Keyboard shortcuts are displayed but NOT registered here; the parent
 *   owns the `keydown` listener so it can route shortcuts to the right
 *   handler regardless of whether the menu is open.
 *
 * Visual style follows the existing slate-950/slate-100 palette and the
 * indigo accent used throughout the app.
 */
const MenuBar: React.FC<MenuBarProps> = ({ menus, className = '' }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  // Close on outside click.
  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openIndex]);

  // Close on Escape.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenIndex(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [openIndex]);

  const handleSelect = useCallback(
    (item: MenuItem) => {
      if (item.type === 'separator') return;
      if (!item.onSelect) return;
      setOpenIndex(null);
      // Defer so the menu visually closes before any modal opens.
      setTimeout(item.onSelect, 0);
    },
    []
  );

  return (
    <div
      ref={rootRef}
      role="menubar"
      aria-label="Menu principal"
      className={`flex items-stretch h-8 bg-slate-900 border-b border-slate-800 select-none text-xs text-slate-300 ${className}`}
    >
      {menus.map((menu, idx) => {
        const isOpen = openIndex === idx;
        const buttonId = `${idPrefix}-btn-${idx}`;
        const menuId = `${idPrefix}-menu-${idx}`;
        return (
          <div key={menu.label} className="relative">
            <button
              id={buttonId}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={isOpen ? menuId : undefined}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              onMouseEnter={() => {
                // Only switch on hover when *some* menu is already open —
                // otherwise hover would feel intrusive.
                if (openIndex !== null && openIndex !== idx) {
                  setOpenIndex(idx);
                }
              }}
              className={`px-3 inline-flex items-center transition-colors hover:bg-slate-800 ${
                isOpen ? 'bg-slate-800 text-white' : ''
              }`}
            >
              {menu.label}
            </button>
            {isOpen && (
              <div
                id={menuId}
                role="menu"
                aria-labelledby={buttonId}
                className="absolute left-0 top-full mt-px w-64 bg-slate-900 border border-slate-700 rounded-md shadow-2xl py-1 z-50"
              >
                {menu.items.map((item, itemIdx) => {
                  if (item.type === 'separator') {
                    return (
                      <div
                        key={`sep-${itemIdx}`}
                        role="separator"
                        className="my-1 h-px bg-slate-800"
                      />
                    );
                  }
                  const disabled = !item.onSelect;
                  return (
                    <button
                      key={`${item.label}-${itemIdx}`}
                      role="menuitem"
                      disabled={disabled}
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center justify-between gap-4 px-3 py-1.5 text-left text-xs transition-colors ${
                        disabled
                          ? 'text-slate-600 cursor-not-allowed'
                          : 'text-slate-200 hover:bg-indigo-600/20 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {/* Reserve the slot for the check icon so labels
                            line up across rows whether they are checked
                            or not. */}
                        <span className="w-3.5 h-3.5 flex-shrink-0">
                          {item.checked && (
                            <CheckIcon className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.shortcut && (
                        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                          {item.shortcut}
                        </span>
                      )}
                      {/* Visual hint for items that lead to deeper UIs
                          (settings, tutorial). Cheap detail that mirrors
                          desktop conventions. */}
                      {!item.shortcut && item.label.endsWith('…') && (
                        <ChevronRightIcon className="w-3 h-3 text-slate-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MenuBar;
