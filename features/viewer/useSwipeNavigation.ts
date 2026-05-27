import { useEffect, useRef, RefObject } from 'react';

interface UseSwipeNavigationParams {
  containerRef: RefObject<HTMLDivElement | null>;
  onNext?: () => void;
  onPrev?: () => void;
  enabled: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
}

export function useSwipeNavigation({
  containerRef,
  onNext,
  onPrev,
  enabled,
  onSwipe,
}: UseSwipeNavigationParams): void {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const fingerCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        // More than one finger - not a swipe
        fingerCountRef.current = e.touches.length;
        touchStartRef.current = null;
        return;
      }
      fingerCountRef.current = 1;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        fingerCountRef.current = e.touches.length;
        touchStartRef.current = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || fingerCountRef.current !== 1) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.time;

      touchStartRef.current = null;

      // Must be a quick gesture (under 500ms)
      if (elapsed > 500) return;

      // Threshold: 50px horizontal, less than 30px vertical deviation
      if (Math.abs(deltaX) >= 50 && Math.abs(deltaY) < 30) {
        if (deltaX < 0) {
          // Swipe left = next page
          onNext?.();
          onSwipe?.('left');
        } else {
          // Swipe right = previous page
          onPrev?.();
          onSwipe?.('right');
        }
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, onNext, onPrev, enabled, onSwipe]);
}
