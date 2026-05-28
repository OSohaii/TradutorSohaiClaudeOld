import { useEffect, useState } from 'react';

/**
 * Returns whether the viewport currently matches the "mobile" range
 * (< 768px, mirroring Tailwind's `md` breakpoint).
 *
 * Uses `matchMedia` so the hook re-renders on viewport changes (window
 * resize, orientation change). Renders to `false` during the first paint
 * to avoid layout flicker on devices that match the desktop range.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
