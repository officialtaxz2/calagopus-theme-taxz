// Hilfe beim Absturz (Designvorgabe 9.11, Idee 13), spielneutral. Grundlage sind die Absturz-Aufzeichnungen des Panels
// (Exit-Code, "vom System beendet / Speicher voll", Log der letzten Zeilen), die es fuer jeden Server gibt.
// Ein Absturz gilt als offen, solange der Server danach nicht wieder lief (Statusverlauf des Panels), er hoechstens
// 24 Stunden her ist und niemand die Karte ausgeblendet hat. Die Ursache kommt nur aus spielunabhaengigen Signalen:
// Speicher voll (OOM), Signal des Systems, Port belegt ("address already in use" des Betriebssystems), sonst "unbekannt".
// Keine Mustererkennung fuer einzelne Spiele.

import { faFileLines, faMemory, faPlay, faSkull, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import type { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getResourceHistory from '@/api/server/resources/getResourceHistory.ts';
import getCrashes from '@/api/server/logs/getCrashes.ts';
import getCrashLog from '@/api/server/logs/getCrashLog.ts';
import sendPowerAction from '@/api/server/sendPowerAction.ts';
import { isAdmin } from '@/lib/auth/permissions.ts';
import { isConflictingState } from '@/lib/domain/server.ts';
import { exitCodeSignal } from '@/lib/format/exitCode.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import type { serverCrashSchema, serverSchema } from '@/lib/schemas/server/server.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { lineLevel } from './consoleLevel.ts';
import { type PowerState, type StatusInfo, statusOf } from './serverStatus.ts';
import { cleanLine } from './StartProgress.tsx';

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
  let status = statusOf(server ?? {}, state);
  if (!flagged && disconnected) status = { tone: 'off', label: 'Getrennt' };
  else if (!flagged && crash) status = { tone: 'bad', label: 'Abgestürzt' };
  return { status, crash, disconnected };
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
  if (crash.oomKilled)
    return { short: 'Speicher voll', text: 'Speicher voll: Das System hat den Server beendet, weil der RAM nicht reichte.' };
  if (log && PORT_IN_USE.test(log))
    return { short: 'Port belegt', text: 'Port belegt: Ein anderes Programm nutzt die Adresse des Servers schon.' };
  const signal = exitCodeSignal(crash.exitCode);
  if (signal) return { short: 'Vom System beendet', text: `Vom System beendet (${signal}, Exit-Code ${crash.exitCode}).` };
  if (crash.exitCode !== 0)
    return { short: 'Ursache unbekannt', text: `Ursache unbekannt. Der Server endete mit Exit-Code ${crash.exitCode}.` };
  return { short: 'Ursache unbekannt', text: 'Ursache unbekannt. Der Server hat sich unerwartet beendet.' };
}

const ERROR_LINE = /exception/i;

export function ago(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}

const when = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
        addToast(`${server.name} wird gestartet.`, 'success');
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
          <h2 id={`taxz-crash-${crash.id}`}>{server.name} ist abgestürzt</h2>
          <span>
            {when.format(crash.timestamp)} ({ago(crash.timestamp)})
          </span>
        </div>
        <button
          type='button'
          className='taxz-ib'
          aria-label='Absturzmeldung ausblenden'
          onClick={() => dismissCrash(server.uuid, crash.id)}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <p className='taxz-crash-cause'>{cause.text}</p>
      {lines.length > 0 && (
        <div className='taxz-crash-log' aria-label='Letzte Konsolenzeilen vor dem Absturz'>
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
            {starting ? 'Startet …' : 'Neu starten'}
          </button>
        )}
        {isAdmin(user, 'servers.update') && (
          <NavLink className='taxz-btn' to={`/admin/servers/${server.uuid}/settings`}>
            <FontAwesomeIcon icon={faMemory} aria-hidden='true' />
            Speicher anpassen
          </NavLink>
        )}
        <NavLink className='taxz-btn' to={`/server/${server.uuidShort}/console/crashes?crash=${crash.id}`}>
          <FontAwesomeIcon icon={faFileLines} aria-hidden='true' />
          Ganzes Log
        </NavLink>
      </div>
    </section>
  );
}
