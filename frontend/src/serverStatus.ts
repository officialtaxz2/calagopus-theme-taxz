// Gemeinsame Status-Logik fuer Serverkarten, Listenzeilen, Server-Kopf und Unterzeile der Serverliste.

import { useSyncExternalStore } from 'react';
import { getExtTranslations } from './translations.ts';


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
  const { t } = getExtTranslations();
  if (server.isSuspended) return { tone: 'bad', label: t('status.suspended', {}) };
  if (server.isTransferring) return { tone: 'info', label: t('status.transferring', {}) };
  if (server.status === 'installing') return { tone: 'info', label: t('status.installing', {}) };
  if (server.status === 'install_failed') return { tone: 'bad', label: t('status.installFailed', {}) };
  if (server.status === 'restoring_backup') return { tone: 'info', label: t('status.restoringBackup', {}) };
  if (server.status === 'backup_restore_failed') return { tone: 'bad', label: t('status.backupRestoreFailed', {}) };
  if (server.nodeMaintenanceEnabled) return { tone: 'warn', label: t('status.maintenance', {}) };
  switch (state) {
    case 'running':
      return { tone: 'ok', label: t('status.running', {}) };
    case 'starting':
      return { tone: 'warn', label: t('status.starting', {}) };
    case 'stopping':
      return { tone: 'warn', label: t('status.stopping', {}) };
    case 'offline':
      return { tone: 'off', label: t('status.offline', {}) };
    default:
      return { tone: 'off', label: t('status.unknown', {}) };
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

/** Sprache des Benutzers fuer Zahlen und Datumsangaben ("de" -> 3,1; "en" -> 3.1). */
export function locale(): string {
  return getExtTranslations().language || 'en';
}

export const num = (value: number, digits = 1) =>
  new Intl.NumberFormat(locale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);

/** Bytes als "3,1 GiB" (Komma je nach Sprache, 1024er Schritte wie im Panel). */
export function bytes(value: number): string {
  if (!value || value < 1) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${num(value / 1024 ** i)} ${units[i]}`;
}

/** Kurzform fuer enge Kennzahlen: "1,1 M", "12,6 G" (wie im Prototyp "3,1 / 8 G"). */
export function bytesShort(value: number): string {
  if (!value || value < 1) return '0';
  const units = ['B', 'K', 'M', 'G', 'T'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${num(value / 1024 ** i)} ${units[i]}`;
}

export function uptime(ms: number): string {
  const { t } = getExtTranslations();
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return t('uptime.days', { days: d, hours: h });
  if (h > 0) return t('uptime.hours', { hours: h, minutes: m });
  if (m > 0) return t('uptime.minutes', { minutes: m });
  return t('uptime.seconds', { seconds: s });
}

