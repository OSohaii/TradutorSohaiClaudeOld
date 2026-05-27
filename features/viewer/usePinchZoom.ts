import { useEffect, useRef, RefObject } from 'react';

interface UsePinchZoomParams {
  containerRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  setZoom: (zoom: number) => void;
  enabled: boolean;
}

function getDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function usePinchZoom({
  containerRef,
  zoom,
  setZoom,
  enabled,
}: UsePinchZoomParams): void {
  const initialDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const zoomRef = useRef(zoom);

  // Keep zoomRef in sync
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Start pinch
        initialDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
        initialZoomRef.current = zoomRef.current;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        // Double-tap detection
        const now = Date.now();
        const touch = e.touches[0];
        if (
          lastTapRef.current &&
          now - lastTapRef.current.time < 300 &&
          Math.abs(touch.clientX - lastTapRef.current.x) < 30 &&
          Math.abs(touch.clientY - lastTapRef.current.y) < 30
        ) {
          // Double tap - reset zoom
          setZoom(1);
          lastTapRef.current = null;
          e.preventDefault();
        } else {
          lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistanceRef.current !== null) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistanceRef.current;
        const newZoom = Math.min(4, Math.max(0.5, initialZoomRef.current * scale));
        setZoom(newZoom);
      }
    };

    const handleTouchEnd = () => {
      initialDistanceRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, setZoom, enabled]);
}
