// Gemeinsame Status-Logik fuer Serverkarten, Listenzeilen, Server-Kopf und Unterzeile der Serverliste.

import { useSyncExternalStore } from 'react';

export type PowerState = 'offline' | 'starting' | 'stopping' | 'running';
export type Tone = 'ok' | 'warn' | 'off' | 'bad' | 'info';

export interface StatusInfo {
  tone: Tone;
  label: string;
}

interface ServerFlags {
  status?: string | null;
  isSuspended?: boolean;
  isTransferring?: boolean;
  nodeMaintenanceEnabled?: boolean;
}

export function statusOf(server: ServerFlags, state: PowerState | null | undefined): StatusInfo {
  if (server.isSuspended) return { tone: 'bad', label: 'Gesperrt' };
  if (server.isTransferring) return { tone: 'info', label: 'Wird umgezogen' };
  if (server.status === 'installing') return { tone: 'info', label: 'Wird installiert' };
  if (server.status === 'install_failed') return { tone: 'bad', label: 'Installation fehlgeschlagen' };
  if (server.status === 'restoring_backup') return { tone: 'info', label: 'Backup wird eingespielt' };
  if (server.status === 'backup_restore_failed') return { tone: 'bad', label: 'Backup fehlgeschlagen' };
  if (server.nodeMaintenanceEnabled) return { tone: 'warn', label: 'Wartung' };
  switch (state) {
    case 'running':
      return { tone: 'ok', label: 'Läuft' };
    case 'starting':
      return { tone: 'warn', label: 'Startet' };
    case 'stopping':
      return { tone: 'warn', label: 'Stoppt' };
    case 'offline':
      return { tone: 'off', label: 'Gestoppt' };
    default:
      return { tone: 'off', label: 'Unbekannt' };
  }
}

export function isActive(state: PowerState | null | undefined) {
  return state === 'running' || state === 'starting' || state === 'stopping';
}

// Welche Serverkarten gerade sichtbar sind und ob sie laufen, fuer "3 Server, davon 2 aktiv" im Seitenkopf.
const visible = new Map<string, boolean>();
const listeners = new Set<() => void>();
let snapshot = { total: 0, active: 0 };

function emit() {
  let active = 0;
  for (const on of visible.values()) if (on) active++;
  if (snapshot.total !== visible.size || snapshot.active !== active) {
    snapshot = { total: visible.size, active };
    listeners.forEach((listener) => listener());
  }
}

export function reportVisibleServer(uuid: string, active: boolean) {
  visible.set(uuid, active);
  emit();
  return () => {
    visible.delete(uuid);
    emit();
  };
}

export function useVisibleServerCounts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

const de = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
export const num = (value: number, digits = 1) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);

/** Bytes als "3,1 GiB" (deutsches Komma, 1024er Schritte wie im Panel). */
export function bytes(value: number): string {
  if (!value || value < 1) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${de.format(value / 1024 ** i)} ${units[i]}`;
}

/** Kurzform fuer enge Kennzahlen: "1,1 M", "12,6 G" (wie im Prototyp "3,1 / 8 G"). */
export function bytesShort(value: number): string {
  if (!value || value < 1) return '0';
  const units = ['B', 'K', 'M', 'G', 'T'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${de.format(value / 1024 ** i)} ${units[i]}`;
}

export function uptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  if (m > 0) return `${m} Min`;
  return `${s} s`;
}
