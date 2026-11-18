// Lichtkante (Designvorgabe 9.9, Idee 10): Bewegt sich die Maus ueber eine Karte, leuchtet deren Rand an der Mausposition
// (radialer Verlauf 220 px in glow-c 90 %, siehe app.css). Nur mit Maus (nicht bei Touch oder Stift), nicht bei
// "Bewegung reduzieren" und nur im taxz-Theme.

import { isTaxzActive } from './prefs.ts';

const CARDS = '.taxz-sc, .taxz-srow, .taxz-kpi, .taxz-sect, .taxz-akpi';

export function registerGlow() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lit: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;

  const clear = () => {
    lit?.classList.remove('taxz-lit');
    lit = null;
  };

  const update = () => {
    frame = 0;
    const event = last;
    if (!event) return;
    const target = event.target instanceof Element ? (event.target.closest(CARDS) as HTMLElement | null) : null;
    if (target !== lit) {
      clear();
      if (target) {
        lit = target;
        target.classList.add('taxz-lit');
      }
    }
    if (!lit) return;
    const box = lit.getBoundingClientRect();
    lit.style.setProperty('--taxz-mx', `${event.clientX - box.left}px`);
    lit.style.setProperty('--taxz-my', `${event.clientY - box.top}px`);
  };

  document.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || reduced.matches || !isTaxzActive()) {
        if (lit) clear();
        return;
      }
      last = event;
      if (!frame) frame = window.requestAnimationFrame(update);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', clear);
}
