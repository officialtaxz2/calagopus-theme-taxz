// Verlaufskurven (Designvorgabe 9.3, Idee 4): CPU, RAM und Netzwerk der letzten Stunde.
// Grundlage ist der Verlauf, den das Panel ohnehin fuer jeden Server speichert (/resources/history, eine Minute je Punkt),
// dazu die Live-Werte aus dem bestehenden Strom. Damit ist die Kurve sofort gefuellt, fuer jedes Spiel gleich.
// Liefert der Verlauf nichts (fehlendes Recht, Node nicht erreichbar), fuellt sich die Kurve nur aus den Live-Werten.

import { useEffect, useSyncExternalStore } from 'react';
import getResourceHistory from '@/api/server/resources/getResourceHistory.ts';

export interface Sample {
  t: number;
  cpu: number | null;
  mem: number | null;
  /** Netzwerk in Byte pro Sekunde (empfangen plus gesendet) */
  net: number | null;
}

interface Series {
  samples: Sample[];
  fetchedAt: number;
  loading: boolean;
  lastLive: { t: number; rx: number; tx: number } | null;
}

const WINDOW_MS = 60 * 60 * 1000;
const LIVE_STEP_MS = 5000;
const REFETCH_MS = 5 * 60 * 1000;

const series = new Map<string, Series>();
const listeners = new Set<() => void>();
const EMPTY: Sample[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function entry(uuid: string): Series {
  let current = series.get(uuid);
  if (!current) {
    current = { samples: [], fetchedAt: 0, loading: false, lastLive: null };
    series.set(uuid, current);
  }
  return current;
}

function trim(samples: Sample[]): Sample[] {
  const from = Date.now() - WINDOW_MS;
  const index = samples.findIndex((sample) => sample.t >= from);
  return index <= 0 ? samples : samples.slice(index);
}

function load(uuid: string) {
  const current = entry(uuid);
  if (current.loading || Date.now() - current.fetchedAt < REFETCH_MS) return;
  current.loading = true;
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_MS);
  getResourceHistory(uuid, start, end, 60)
    .then((history) => {
      const resolution = history.resolution || 60;
      const fromApi: Sample[] = history.points.map((point) => ({
        t: point.start.getTime(),
        cpu: point.cpuAverage,
        mem: point.memoryAverageBytes,
        net:
          point.networkRxBytes === null && point.networkTxBytes === null
            ? null
            : ((point.networkRxBytes ?? 0) + (point.networkTxBytes ?? 0)) / resolution,
      }));
      const lastApi = fromApi.length ? fromApi[fromApi.length - 1].t : 0;
      const live = current.samples.filter((sample) => sample.t > lastApi);
      current.samples = trim([...fromApi, ...live]);
    })
    .catch(() => {
      // Kein Verlauf verfuegbar: Kurve fuellt sich aus den Live-Werten.
    })
    .finally(() => {
      current.loading = false;
      current.fetchedAt = Date.now();
      emit();
    });
}

export interface LiveStats {
  state: string;
  cpuAbsolute: number;
  memoryBytes: number;
  network: { rxBytes: number; txBytes: number };
}

/** Haengt einen Live-Wert an (hoechstens alle 5 s), damit die Kurve zwischen zwei Verlaufsabrufen weiterlaeuft. */
export function pushLive(uuid: string, stats: LiveStats | null | undefined) {
  if (!stats) return;
  const current = entry(uuid);
  const now = Date.now();
  const last = current.samples[current.samples.length - 1];
  const prev = current.lastLive;
  const rx = stats.network.rxBytes;
  const tx = stats.network.txBytes;
  let net: number | null = null;
  if (prev && now > prev.t && rx >= prev.rx && tx >= prev.tx) {
    net = (rx - prev.rx + (tx - prev.tx)) / ((now - prev.t) / 1000);
  }
  if (last && now - last.t < LIVE_STEP_MS) return;
  current.lastLive = { t: now, rx, tx };
  const offline = stats.state === 'offline';
  current.samples = trim([
    ...current.samples,
    {
      t: now,
      cpu: offline ? null : stats.cpuAbsolute,
      mem: offline ? null : stats.memoryBytes,
      net: offline ? null : net,
    },
  ]);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Verlauf eines Servers; laedt beim ersten Aufruf den gespeicherten Verlauf der letzten Stunde. */
export function useResourceSeries(uuid: string | null | undefined): Sample[] {
  useEffect(() => {
    if (uuid) load(uuid);
  }, [uuid]);
  return useSyncExternalStore(subscribe, () => (uuid ? (series.get(uuid)?.samples ?? EMPTY) : EMPTY));
}
