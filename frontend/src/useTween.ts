// Weich laufende Zahlen (Designvorgabe 9.4, Idee 5): Wertewechsel laufen in 400 ms; bei "Bewegung reduzieren" springen sie.

import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useTween(target: number, duration = 400): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const shown = useRef(target);

  useEffect(() => {
    if (reduced() || !Number.isFinite(target) || !Number.isFinite(shown.current)) {
      shown.current = target;
      setValue(target);
      return;
    }
    from.current = shown.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      shown.current = from.current + (target - from.current) * eased;
      setValue(shown.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
