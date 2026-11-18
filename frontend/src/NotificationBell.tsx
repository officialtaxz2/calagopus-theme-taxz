// Benachrichtigungen mit Verlauf (Designvorgabe 9.8, Idee 15): Glocke oben in der Seitenleiste bzw. im Handy-Kopf,
// Punkt bei Ungelesenem, Liste der letzten Ereignisse. Quelle ist der Endpunkt der Erweiterung
// (/api/client/extensions/de.taxz.theme/notifications), der Abstuerze, Backups und fehlgeschlagene Zeitplaene aller
// eigenen Server der letzten sieben Tage sammelt, jeweils nur mit dem passenden Recht. Admins mit Recht "stats.read"
// sehen zusaetzlich ein verfuegbares Panel-Update (Update-Pruefung des Panels). Dieser Eintrag ist nur ein Hinweis ohne
// Link: Neue Panel-Versionen kommen ueber das Repo (woechentlicher Update-Check als PR), nicht ueber den Updater im Panel.
// "Gelesen" ist ein Zeitpunkt (plus die zuletzt gesehene Panel-Version) in den Benutzereinstellungen, also auf allen Geraeten gleich.

import {
  faArrowUp,
  faBell,
  faBoxArchive,
  faCalendarXmark,
  faCheck,
  faSkull,
  faTriangleExclamation,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Popover } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import getUpdates from '@/api/admin/system/updates/getUpdates.ts';
import { isAdmin } from '@/lib/auth/permissions.ts';
import { exitCodeSignal } from '@/lib/format/exitCode.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import { isOutdated } from '@/lib/version.ts';
import { useAuth } from '@/providers/contexts/authContext.ts';
import { ago } from './CrashHelp.tsx';

const eventSchema = z.object({
  id: z.string(),
  kind: z.enum(['crash', 'backup_ok', 'backup_failed', 'schedule_failed']),
  at: z.coerce.date(),
  server: z.object({ uuid: z.string(), uuid_short: z.string(), name: z.string() }),
  name: z.string().nullable(),
  exit_code: z.number().nullable(),
  oom_killed: z.boolean().nullable(),
  crash_id: z.number().nullable(),
});
const responseSchema = z.object({ events: z.array(eventSchema), unavailable: z.array(z.string()) });
type Event = z.infer<typeof eventSchema>;

export const READ_KEY = 'de.taxz.theme::notifications_read';
const readSchema = z.object({ at: z.string().nullable(), update: z.string().nullable() });
const NOTHING_READ: z.infer<typeof readSchema> = { at: null, update: null };

async function getNotifications() {
  const { data } = await axiosInstance.get('/api/client/extensions/de.taxz.theme/notifications');
  return responseSchema.parse(data);
}

interface Item {
  id: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  icon: IconDefinition;
  title: string;
  meta: string;
  to: string | null;
  at: Date | null;
  unread: boolean;
}

function crashText(event: Event) {
  if (event.oom_killed) return 'Speicher voll';
  const signal = event.exit_code !== null ? exitCodeSignal(event.exit_code) : null;
  if (signal) return `Vom System beendet (${signal})`;
  return event.exit_code !== null ? `Exit-Code ${event.exit_code}` : 'Ursache unbekannt';
}

function toItem(event: Event, readAt: number): Omit<Item, 'meta'> & { detail: string | null } {
  const base = `/server/${event.server.uuid_short}`;
  const unread = event.at.getTime() > readAt;
  switch (event.kind) {
    case 'crash':
      return {
        id: event.id,
        tone: 'bad',
        icon: faSkull,
        title: `${event.server.name} ist abgestürzt`,
        detail: crashText(event),
        to: `${base}/console/crashes?crash=${event.crash_id}`,
        at: event.at,
        unread,
      };
    case 'backup_ok':
      return {
        id: event.id,
        tone: 'ok',
        icon: faBoxArchive,
        title: `Backup „${event.name}“ fertig`,
        detail: null,
        to: `${base}/backups`,
        at: event.at,
        unread,
      };
    case 'backup_failed':
      return {
        id: event.id,
        tone: 'bad',
        icon: faTriangleExclamation,
        title: `Backup „${event.name}“ fehlgeschlagen`,
        detail: null,
        to: `${base}/backups`,
        at: event.at,
        unread,
      };
    case 'schedule_failed':
      return {
        id: event.id,
        tone: 'warn',
        icon: faCalendarXmark,
        title: `Zeitplan „${event.name}“ fehlgeschlagen`,
        detail: null,
        to: `${base}/schedules`,
        at: event.at,
        unread,
      };
  }
}

function useNotifications() {
  const { user } = useAuth();
  const [read, setRead] = useUserSetting(READ_KEY, readSchema, NOTHING_READ);
  const canSeeUpdates = isAdmin(user, 'stats.read');

  const events = useQuery({
    queryKey: ['taxz', 'notifications', user?.uuid],
    queryFn: getNotifications,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
  const updates = useQuery({
    queryKey: ['taxz', 'notifications', 'panel-update'],
    queryFn: getUpdates,
    enabled: canSeeUpdates,
    staleTime: 30 * 60_000,
  });

  const readAt = read.at ? new Date(read.at).getTime() : 0;
  const update =
    canSeeUpdates && updates.data && isOutdated(updates.data.latestPanelVersion, updates.data.panelVersion)
      ? updates.data
      : null;

  const items = useMemo<Item[]>(() => {
    const list: Item[] = (events.data?.events ?? []).map((event) => {
      const { detail, ...item } = toItem(event, readAt);
      const when = ago(event.at);
      return { ...item, meta: [event.server.name, detail, when].filter(Boolean).join(' · ') };
    });
    if (update) {
      list.unshift({
        id: `update:${update.latestPanelVersion}`,
        tone: 'info',
        icon: faArrowUp,
        title: `Panel-Update verfügbar: ${update.latestPanelVersion}`,
        meta: `Installiert: ${update.panelVersion} · kommt mit dem Update-PR, nicht im Panel installieren`,
        to: null,
        at: null,
        unread: read.update !== update.latestPanelVersion,
      });
    }
    return list;
  }, [events.data, readAt, update, read.update]);

  const unread = items.filter((item) => item.unread).length;
  const markAllRead = () => {
    const newest = (events.data?.events ?? []).reduce((max, event) => Math.max(max, event.at.getTime()), Date.now());
    setRead({ at: new Date(newest).toISOString(), update: update?.latestPanelVersion ?? read.update });
  };

  return {
    items,
    unread,
    markAllRead,
    loading: events.isLoading,
    error: events.isError,
    retry: () => events.refetch(),
    unavailable: events.data?.unavailable.length ?? 0,
  };
}

export default function NotificationBell({ placement }: { placement: 'sidebar' | 'mobile' }) {
  const { user } = useAuth();
  if (!user || user.suspended) return null;
  return <Bell placement={placement} />;
}

function Bell({ placement }: { placement: 'sidebar' | 'mobile' }) {
  const [opened, setOpened] = useState(false);
  const { items, unread, markAllRead, loading, error, retry, unavailable } = useNotifications();
  const label = unread > 0 ? `Benachrichtigungen, ${unread} ungelesen` : 'Benachrichtigungen';

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position={placement === 'sidebar' ? 'right-start' : 'bottom-end'}
      offset={placement === 'sidebar' ? 22 : 10}
      width={placement === 'sidebar' ? 380 : Math.min(420, window.innerWidth - 24)}
      trapFocus
      returnFocus
      withinPortal
      shadow='md'
      classNames={{ dropdown: classNames('taxz-bell-pop', `is-${placement}`) }}
    >
      <Popover.Target>
        <button
          type='button'
          className={classNames(placement === 'sidebar' ? 'taxz-bell' : 'taxz-ph-btn taxz-bell-m', opened && 'is-on')}
          aria-label={label}
          title={label}
          aria-haspopup='dialog'
          aria-expanded={opened}
          onClick={() => setOpened((o) => !o)}
        >
          <FontAwesomeIcon icon={faBell} />
          {unread > 0 && <span className='taxz-bell-dot' aria-hidden='true' />}
        </button>
      </Popover.Target>
      <Popover.Dropdown role='dialog' aria-label='Benachrichtigungen'>
        <div className='taxz-bell-head'>
          <h2>Benachrichtigungen</h2>
          {/* aria-disabled statt disabled: der Fokus bleibt nach dem Klick im Dialog (Escape schliesst weiter) */}
          <button
            type='button'
            className='taxz-bell-read'
            onClick={() => unread > 0 && markAllRead()}
            aria-disabled={unread === 0}
          >
            <FontAwesomeIcon icon={faCheck} aria-hidden='true' />
            Alle gelesen
          </button>
        </div>
        {error ? (
          <div className='taxz-bell-empty'>
            Benachrichtigungen konnten nicht geladen werden.{' '}
            <button type='button' className='taxz-bell-retry' onClick={retry}>
              Erneut versuchen
            </button>
          </div>
        ) : loading ? (
          <div className='taxz-bell-empty'>Wird geladen …</div>
        ) : items.length === 0 ? (
          <div className='taxz-bell-empty'>Keine Ereignisse in den letzten 7 Tagen.</div>
        ) : (
          <ul className='taxz-bell-list'>
            {items.map((item) => {
              const className = classNames('taxz-bell-item', `is-${item.tone}`, item.unread && 'is-unread');
              const body = (
                <>
                  <span className='taxz-bell-ic' aria-hidden='true'>
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                  <span className='taxz-bell-txt'>
                    <b>{item.title}</b>
                    <small>{item.meta}</small>
                  </span>
                  {item.unread && (
                    <span className='taxz-bell-new'>
                      <span className='sr-only'>ungelesen</span>
                    </span>
                  )}
                </>
              );
              return (
                <li key={item.id}>
                  {item.to ? (
                    <Link to={item.to} className={className} onClick={() => setOpened(false)}>
                      {body}
                    </Link>
                  ) : (
                    <div className={className}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {unavailable > 0 && (
          <p className='taxz-bell-note'>
            Absturzverlauf von {unavailable === 1 ? 'einem Server' : `${unavailable} Servern`} gerade nicht abrufbar.
          </p>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
