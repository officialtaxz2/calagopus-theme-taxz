// Fester Hintergrund hinter dem ganzen Panel (Horizont, Topografie, Nordlicht). Die Farben kommen nur aus den
// CSS-Variablen --glow-c/--glow2, Hell/Dunkel und Akzent wechseln also ohne neues Zeichnen.
// Das Element liegt direkt in <body>, damit es auch auf der Anmeldeseite und ausserhalb von React wirkt.

import type { Background } from './prefs.ts';

let container: HTMLDivElement | null = null;
let current: Background | null = null;

function grain(id: string): string {
  return `<svg class="taxz-grain" aria-hidden="true" focusable="false"><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#${id})"/></svg>`;
}

function horizonSvg(): string {
  return `<svg class="taxz-horizon" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="taxz-hz-l" x1="0" x2="1"><stop offset="0" style="stop-color:rgb(var(--glow2));stop-opacity:0"/><stop offset=".5" style="stop-color:rgb(var(--glow-c))"/><stop offset="1" style="stop-color:rgb(var(--glow2));stop-opacity:0"/></linearGradient>
    <radialGradient id="taxz-hz-h" cx=".5" cy=".78" r=".6"><stop offset="0" style="stop-color:rgb(var(--glow-c));stop-opacity:.42"/><stop offset=".55" style="stop-color:rgb(var(--glow2));stop-opacity:.12"/><stop offset="1" style="stop-color:rgb(var(--glow2));stop-opacity:0"/></radialGradient>
    <filter id="taxz-hz-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter></defs>
    <rect width="1200" height="800" fill="url(#taxz-hz-h)"/>
    <ellipse cx="600" cy="1190" rx="1150" ry="600" style="fill:var(--taxz-hz-shade)"/>
    <ellipse cx="600" cy="1190" rx="1150" ry="600" fill="none" stroke="url(#taxz-hz-l)" stroke-width="16" filter="url(#taxz-hz-b)"/>
    <ellipse cx="600" cy="1190" rx="1150" ry="600" fill="none" stroke="url(#taxz-hz-l)" stroke-width="1.6"/></svg>`;
}

function smoothClosed(points: [number, number][]): string {
  const n = points.length;
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

function topoSvg(): string {
  let lines = '';
  const centers: [number, number, number, number][] = [
    [980, 110, 15, 3.1],
    [140, 760, 13, 1.7],
    [610, 470, 6, 4.4],
  ];
  for (const [cx, cy, n, ph] of centers) {
    for (let k = 1; k <= n; k++) {
      const r = 22 + k * 34;
      const points: [number, number][] = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const m = 1 + 0.16 * Math.sin(3 * a + ph + k * 0.18) + 0.07 * Math.sin(5 * a - ph * 2 + k * 0.3) + 0.04 * Math.sin(9 * a + k);
        points.push([cx + Math.cos(a) * r * m * 1.25, cy + Math.sin(a) * r * m]);
      }
      // Deckkraft nimmt nach aussen ab; Anfang und Ende je Modus aus CSS (--taxz-topo-hi/-lo).
      const f = (k / n).toFixed(3);
      lines += `<path d="${smoothClosed(points)}" fill="none" style="stroke:rgb(var(--glow-c));stroke-opacity:calc(var(--taxz-topo-hi) - (var(--taxz-topo-hi) - var(--taxz-topo-lo)) * ${f})" stroke-width="${k % 5 === 0 ? 1.6 : 1}"/>`;
    }
  }
  return `<svg class="taxz-topo" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><radialGradient id="taxz-tg"><stop offset="0" style="stop-color:rgb(var(--glow-c));stop-opacity:.22"/><stop offset="1" style="stop-color:rgb(var(--glow-c));stop-opacity:0"/></radialGradient></defs><circle cx="980" cy="110" r="420" fill="url(#taxz-tg)"/><circle cx="140" cy="760" r="360" fill="url(#taxz-tg)" opacity=".7"/>${lines}</svg>`;
}

function auroraHtml(): string {
  return `<span class="taxz-blob taxz-b1"></span><span class="taxz-blob taxz-b2"></span><span class="taxz-blob taxz-b3"></span>${grain('taxz-gn-a')}`;
}

export function backdropMarkup(background: Background): string {
  if (background === 'aurora') return auroraHtml();
  if (background === 'topo') return topoSvg();
  return horizonSvg() + grain('taxz-gn-h');
}

export function renderBackdrop(background: Background | null) {
  if (!background) {
    container?.remove();
    container = null;
    current = null;
    return;
  }

  if (!container) {
    container = document.createElement('div');
    container.id = 'taxz-backdrop';
    container.setAttribute('aria-hidden', 'true');
    document.body.prepend(container);
  }
  if (current === background) return;

  current = background;
  container.dataset.bg = background;
  container.innerHTML = backdropMarkup(background);
}
