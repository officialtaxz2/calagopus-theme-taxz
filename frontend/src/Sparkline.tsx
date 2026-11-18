// Kleine Verlaufskurve (Idee 4): Linie im Akzent, Flaeche Akzent 15 % nach 0. Rein dekorativ, Werte stehen daneben als Text.
// Mit `times` liegt jeder Punkt an seiner Zeit in der letzten Stunde (rechts = jetzt). Ein Abschnitt erscheint erst, wenn er
// mindestens MIN_SPAN_MS abdeckt: Direkt nach dem Start gaebe es sonst nur einen fast senkrechten Strich am rechten Rand.

import { useId, useMemo } from 'react';

const WINDOW_MS = 60 * 60 * 1000;
const MIN_SPAN_MS = 3 * 60 * 1000;
/** Fehlen laenger Werte (Seite zu, Verlauf nicht abrufbar), wird die Linie unterbrochen statt quer durchgezogen. */
const MAX_GAP_MS = 3 * 60 * 1000;

export default function Sparkline({
  values,
  times,
  max,
  className,
}: {
  values: (number | null)[];
  /** Zeitpunkte der Werte in ms, gleiche Laenge wie `values`; ohne Angabe gleichmaessig verteilt */
  times?: number[];
  /** feste Obergrenze (z. B. CPU-Grenze); ohne Angabe der groesste Wert */
  max?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const paths = useMemo(() => {
    const timed = !!times && times.length === values.length && values.length > 0;
    const points = values.map((value, index) => ({ index, value, t: timed ? times[index] : index }));
    const known = points.filter((point) => point.value !== null) as { index: number; value: number; t: number }[];
    if (known.length < 2) return null;
    const top = Math.max(max ?? 0, ...known.map((point) => point.value), 1e-9);
    const width = 100;
    const height = 32;
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const end = timed ? points[points.length - 1].t : 0;
    const x = (point: { index: number; t: number }) =>
      timed ? width - (Math.min(end - point.t, WINDOW_MS) / WINDOW_MS) * width : point.index * step;
    const y = (value: number) => height - 2 - (Math.min(value, top) / top) * (height - 4);
    // Luecken (Server aus) unterbrechen die Linie
    let line = '';
    let area = '';
    let segment: { x: number; y: number; t: number }[] = [];
    const flush = () => {
      const span = segment.length >= 2 ? segment[segment.length - 1].t - segment[0].t : 0;
      if (segment.length >= 2 && (!timed || span >= MIN_SPAN_MS)) {
        const d = segment.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
        line += `${d} `;
        area += `${d} L${segment[segment.length - 1].x.toFixed(2)} ${height} L${segment[0].x.toFixed(2)} ${height} Z `;
      }
      segment = [];
    };
    for (const point of points) {
      if (point.value === null) {
        flush();
        continue;
      }
      const last = segment[segment.length - 1];
      if (timed && last && point.t - last.t > MAX_GAP_MS) flush();
      segment.push({ x: x(point), y: y(point.value), t: point.t });
    }
    flush();
    return line ? { line, area } : null;
  }, [values, times, max]);

  if (!paths) return null;
  return (
    <svg
      className={className ?? 'taxz-spark'}
      viewBox='0 0 100 32'
      preserveAspectRatio='none'
      aria-hidden='true'
      focusable='false'
    >
      <defs>
        <linearGradient id={`sg${id}`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0' stopColor='var(--accent)' stopOpacity='0.15' />
          <stop offset='1' stopColor='var(--accent)' stopOpacity='0' />
        </linearGradient>
      </defs>
      <path d={paths.area} fill={`url(#sg${id})`} />
      <path
        d={paths.line}
        fill='none'
        stroke='var(--accent)'
        strokeWidth='1.6'
        vectorEffect='non-scaling-stroke'
        strokeLinejoin='round'
      />
    </svg>
  );
}
