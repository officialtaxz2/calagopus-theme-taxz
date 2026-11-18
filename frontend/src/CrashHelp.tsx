// Hilfe beim Absturz (Designvorgabe 9.11, Idee 13), spielneutral. Grundlage sind die Absturz-Aufzeichnungen des Panels
// (Exit-Code, "vom System beendet / Speicher voll", Log der letzten Zeilen), die es fuer jeden Server gibt.
// Ein Absturz gilt als offen, solange der Server danach nicht wieder lief (Statusverlauf des Panels), er hoechstens
// 24 Stunden her ist und niemand die Karte ausgeblendet hat. Die Ursache kommt nur aus spielunabhaengigen Signalen:
// Speicher voll (OOM), Signal des Systems, Port belegt ("address already in use" des Betriebssystems), sonst "unbekannt".
// Keine Mustererkennung fuer einzelne Spiele.

import type { z } from 'zod';
import { faFileLines, faMemory, faPlay, faSkull, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import type { serverCrashSchema, serverSchema } from '@/lib/schemas/server/server.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import getCrashes from '@/api/server/logs/getCrashes.ts';
import getCrashLog from '@/api/server/logs/getCrashLog.ts';
import getResourceHistory from '@/api/server/resources/getResourceHistory.ts';
import sendPowerAction from '@/api/server/sendPowerAction.ts';
import { isAdmin } from '@/lib/auth/permissions.ts';
import { isConflictingState } from '@/lib/domain/server.ts';
import { exitCodeSignal } from '@/lib/format/exitCode.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { lineLevel } from './consoleLevel.ts';
import { locale, type PowerState, type StatusInfo, statusOf } from './serverStatus.ts';
import { cleanLine } from './StartProgress.tsx';
import { getExtTranslations, useExtTranslations } from './translations.ts';

type Crash = z.infer<typeof serverCrashSchema>;

const RECENT = 24 * 60 * 60 * 1000;
const dismissKey = (uuid: string) => `de.taxz.theme::crash_dismissed_${uuid}`;
const dismissListeners = new Set<() => void>();

export function dismissCrash(uuid: string, id: number) {
  safeLocalStorageSet(dismissKey(uuid), String(id));
  dismissListeners.forEach((listener) => listener());
}

/**
 * Offener Absturz des gerade geoeffneten Servers. Server-Kopf, Server-Karte der Seitenleiste und Browser-Tab nutzen dieselbe
 * Abfrage (gemeinsamer Cache), damit alle drei "Abgestürzt" zeigen statt teils "Gestoppt".
 */
export function useCurrentServerCrash(
  server: z.infer<typeof serverSchema> | null | undefined,
  state: string | null | undefined,
): Crash | null {
  const { user } = useAuth();
  const canReadConsole = useServerCan('control.read-console');
  const enabled = !!server?.uuid && canReadConsole && !isConflictingState(server, user);
  return useOpenCrash(server?.uuid ?? '', state, enabled);
}

/**
 * Status des gerade geoeffneten Servers fuer Kopf, Seitenleiste und Browser-Tab, alle gleich:
 * Sperre/Installation/Wartung des Servers vor allem anderen; ist die Live-Verbindung nach dem ersten Verbinden weg, "Getrennt"
 * (der zuletzt bekannte Zustand waere dann veraltet); sonst "Abgestürzt", solange ein Absturz offen ist; sonst der Zustand.
 */
export function useCurrentServerStatus(
  server: z.infer<typeof serverSchema> | null | undefined,
  state: PowerState | null | undefined,
): { status: StatusInfo; crash: Crash | null; disconnected: boolean } {
  const crash = useCurrentServerCrash(server, state);
  const connected = useServerStore((s) => s.socketConnected);
  const uuid = server?.uuid ?? '';
  const [connectedOnce, setConnectedOnce] = useState('');
  useEffect(() => {
    if (connected && uuid) setConnectedOnce(uuid);
  }, [connected, uuid]);
  const disconnected = !connected && !!uuid && connectedOnce === uuid;
  const flagged = !!(server?.isSuspended || server?.isTransferring || server?.status || server?.nodeMaintenanceEnabled);
  const status = withConnection(statusOf(server ?? {}, state), !flagged && disconnected, !flagged && !!crash);
  return { status, crash, disconnected };
}

// Bewusst eine eigene Funktion statt "let status = ...; if (...) status = ..." im Hook: der React Compiler hat die
// bedingte Neuzuweisung samt Uebersetzungsaufruf als eigenen Block zwischengespeichert, der nicht vom Grundstatus
// abhing, und so nach dem ersten Zeichnen dauerhaft "Gestoppt" gezeigt, obwohl der Server lief.
function withConnection(status: StatusInfo, disconnected: boolean, crashed: boolean): StatusInfo {
  const { t } = getExtTranslations();
  if (disconnected) return { tone: 'off', label: t('status.disconnected', {}) };
  if (crashed) return { tone: 'bad', label: t('status.crashed', {}) };
  return status;
}

/**
 * Der offene Absturz eines Servers oder null. `enabled` nur, wenn der Benutzer die Konsole lesen darf.
 * Teilt sich den Abfrage-Cache mit der Absturz-Seite des Panels.
 */
export function useOpenCrash(uuid: string, state: string | null | undefined, enabled: boolean): Crash | null {
  const queryClient = useQueryClient();
  const offline = state === 'offline';
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    dismissListeners.add(listener);
    return () => {
      dismissListeners.delete(listener);
    };
  }, []);

  // Wird der Server gerade offline, kann ein neuer Absturz dazugekommen sein.
  const previous = useRef(state);
  useEffect(() => {
    // Nur ein echter Wechsel (lief -> aus), nicht der erste bekannte Zustand nach dem Laden der Seite.
    if (previous.current && previous.current !== 'offline' && state === 'offline') {
      queryClient.invalidateQueries({ queryKey: queryKeys.server(uuid).crashes.all() });
    }
    previous.current = state;
  }, [state, uuid, queryClient]);

  const { data: crashes } = useQuery({
    queryKey: queryKeys.server(uuid).crashes.all(),
    queryFn: () => getCrashes(uuid),
    enabled: enabled && offline,
    staleTime: 30_000,
    refetchOnMount: true,
  });

  const latest = useMemo(
    () => (crashes && crashes.length > 0 ? crashes.reduce((a, b) => (b.timestamp > a.timestamp ? b : a)) : null),
    [crashes],
  );
  const recent = !!latest && Date.now() - latest.timestamp.getTime() < RECENT;
  // Lief der Server nach dem Absturz wieder (Statusverlauf), ist der Absturz erledigt.
  const checkRanAgain = !!latest && recent && offline && Date.now() - latest.timestamp.getTime() > 3 * 60_000;
  const { data: ranAgain } = useQuery({
    queryKey: [...queryKeys.server(uuid).crashes.all(), 'taxz-ran-again', latest?.id],
    queryFn: async () => {
      const from = new Date(latest!.timestamp.getTime() + 2 * 60_000);
      const history = await getResourceHistory(uuid, from, new Date(), 24);
      return history.points.some((point) => (point.states?.running ?? 0) > 0);
    },
    enabled: enabled && checkRanAgain,
    staleTime: 60_000,
  });

  if (!enabled || !offline || !latest || !recent) return null;
  if (checkRanAgain && ranAgain !== false) return null;
  if (safeLocalStorageGet(dismissKey(uuid)) === String(latest.id)) return null;
  return latest;
}

const PORT_IN_USE = /address already in use|eaddrinuse/i;

export function crashCause(crash: Crash, log: string | undefined): { short: string; text: string } {
  const { t } = getExtTranslations();
  if (crash.oomKilled) return { short: t('crash.cause.oom', {}), text: t('crash.cause.oomText', {}) };
  if (log && PORT_IN_USE.test(log)) return { short: t('crash.cause.port', {}), text: t('crash.cause.portText', {}) };
  const signal = exitCodeSignal(crash.exitCode);
  if (signal)
    return { short: t('crash.cause.signal', {}), text: t('crash.cause.signalText', { signal, code: crash.exitCode }) };
  if (crash.exitCode !== 0)
    return { short: t('crash.cause.unknown', {}), text: t('crash.cause.unknownCode', { code: crash.exitCode }) };
  return { short: t('crash.cause.unknown', {}), text: t('crash.cause.unknownText', {}) };
}

const ERROR_LINE = /exception/i;

export function ago(date: Date) {
  const { t } = getExtTranslations();
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return t('time.justNow', {});
  if (minutes < 60) return t('time.minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('time.dayAgo', {}) : t('time.daysAgo', { days });
}

const when = (date: Date) =>
  new Intl.DateTimeFormat(locale(), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

/** Absturz-Karte auf der Serverseite. */
export function CrashCard({
  server,
  crash,
  canStart,
}: {
  server: { uuid: string; uuidShort: string; name: string };
  crash: Crash;
  canStart: boolean;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [starting, setStarting] = useState(false);
  const { t } = useExtTranslations();
  const { data: log } = useQuery({
    queryKey: queryKeys.server(server.uuid).crashes.log(crash.id),
    queryFn: () => getCrashLog(server.uuid, crash.id),
    staleTime: Infinity,
  });
  const cause = crashCause(crash, log);

  const lines = useMemo(() => {
    const all = (log ?? '')
      .split('\n')
      .map(cleanLine)
      .filter((line) => line.length > 0);
    return all.slice(-10);
  }, [log]);
  // Hervorgehoben wird die letzte Fehlerzeile (ERROR/FATAL/SEVERE oder Exception).
  const errorIndex = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lineLevel(lines[i]) === 'error' || ERROR_LINE.test(lines[i])) return i;
    }
    return -1;
  }, [lines]);

  const restart = () => {
    setStarting(true);
    sendPowerAction(server.uuid, 'start')
      .then(() => {
        addToast(t('crash.starting', { name: server.name }), 'success');
        dismissCrash(server.uuid, crash.id);
      })
      .catch((error) => addToast(httpErrorToHuman(error), 'error'))
      .finally(() => setStarting(false));
  };

  return (
    <section className='taxz-crash' role='alert' aria-labelledby={`taxz-crash-${crash.id}`}>
      <div className='taxz-crash-head'>
        <span className='taxz-crash-ic' aria-hidden='true'>
          <FontAwesomeIcon icon={faSkull} />
        </span>
        <div className='taxz-crash-title'>
          <h2 id={`taxz-crash-${crash.id}`}>{t('crash.title', { name: server.name })}</h2>
          <span>
            {when(crash.timestamp)} ({ago(crash.timestamp)})
          </span>
        </div>
        <button
          type='button'
          className='taxz-ib'
          aria-label={t('crash.dismiss', {})}
          onClick={() => dismissCrash(server.uuid, crash.id)}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <p className='taxz-crash-cause'>{cause.text}</p>
      {lines.length > 0 && (
        <div className='taxz-crash-log' aria-label={t('crash.lastLines', {})}>
          {lines.map((line, index) => (
            <div key={index} className={index === errorIndex ? 'is-error' : undefined}>
              {line}
            </div>
          ))}
        </div>
      )}
      <div className='taxz-crash-acts'>
        {canStart && (
          <button type='button' className='taxz-btn taxz-btn-primary' onClick={restart} disabled={starting}>
            <FontAwesomeIcon icon={faPlay} aria-hidden='true' />
            {starting ? t('crash.startingButton', {}) : t('crash.restart', {})}
          </button>
        )}
        {isAdmin(user, 'servers.update') && (
          <NavLink className='taxz-btn' to={`/admin/servers/${server.uuid}/settings`}>
            <FontAwesomeIcon icon={faMemory} aria-hidden='true' />
            {t('crash.adjustMemory', {})}
          </NavLink>
        )}
        <NavLink className='taxz-btn' to={`/server/${server.uuidShort}/console/crashes?crash=${crash.id}`}>
          <FontAwesomeIcon icon={faFileLines} aria-hidden='true' />
          {t('crash.fullLog', {})}
        </NavLink>
      </div>
    </section>
  );
}
