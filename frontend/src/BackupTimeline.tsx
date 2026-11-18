// Backups als Zeitleiste (Designvorgabe 9.14, Idee 18): Ueber der Backup-Liste liegen die Backups der letzten Tage als Punkte
// auf einer Linie. Ein Klick zeigt Datum, Groesse und Art sowie "Herunterladen" und "Wiederherstellen" (mit der Rueckfrage
// des Panels, weil es den aktuellen Stand ersetzt). Daten sind die Backups, die die Liste darunter gerade zeigt.
// Ob ein Backup automatisch (Zeitplan) oder von Hand entstand, speichert das Panel nicht; gezeigt wird deshalb der Name.

import { faFileArrowDown, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import type { ExtensionContext } from 'shared';
import type { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import downloadBackup from '@/api/server/backups/downloadBackup.ts';
import { downloadUrl } from '@/lib/network/url.ts';
import type { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import BackupRestoreModal from '@/pages/server/backups/modals/BackupRestoreModal.tsx';
import DatabaseInstanceBackupRestoreModal from '@/pages/server/databases/instances/modals/DatabaseInstanceBackupRestoreModal.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';
import { bytes } from './serverStatus.ts';

type Backup = z.infer<typeof serverBackupSchema>;

const DAY = 24 * 60 * 60 * 1000;
const MIN_DAYS = 14;
const MAX_DAYS = 90;

function stateOf(backup: Backup): { tone: 'ok' | 'warn' | 'bad'; label: string } {
  if (backup.deletionStatus === 'deleting') return { tone: 'warn', label: 'Wird gelöscht' };
  if (!backup.completed) return { tone: 'warn', label: 'Läuft' };
  if (!backup.isSuccessful) return { tone: 'bad', label: 'Fehlgeschlagen' };
  return { tone: 'ok', label: 'Fertig' };
}

const dateTime = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const shortDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });

export default function BackupTimeline() {
  const isTaxz = useIsTaxz();
  const { pathname } = useLocation();
  // Nur auf der Seite "Backups" selbst, nicht in den Unterseiten (System, Datenbanken).
  if (!isTaxz || !/^\/server\/[^/]+\/backups\/?$/.test(pathname)) return null;
  return <Timeline />;
}

function Timeline() {
  const backups = useServerStore((state) => state.backups.data);
  const server = useServerStore((state) => state.server);
  const { addToast, addPendingToast } = useToast();
  const canDownload = useServerCan('backups.download');
  const canRestore = useServerCan('backups.restore');
  const [selected, setSelected] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const { start, end, dots, levels } = useMemo(() => {
    const now = Date.now();
    const oldest = backups.reduce((min, backup) => Math.min(min, backup.created.getTime()), now);
    const span = Math.min(MAX_DAYS * DAY, Math.max(MIN_DAYS * DAY, now - oldest + DAY / 2));
    const from = now - span;
    const sorted = backups
      .filter((backup) => backup.created.getTime() >= from)
      .sort((a, b) => a.created.getTime() - b.created.getTime());
    let lastX = -100;
    let level = 0;
    const placed = sorted.map((backup) => {
      const x = ((backup.created.getTime() - from) / span) * 100;
      level = x - lastX < 3.5 ? (level + 1) % 3 : 0;
      lastX = x;
      return { backup, x, level };
    });
    return { start: from, end: now, dots: placed, levels: placed.reduce((max, dot) => Math.max(max, dot.level), 0) };
  }, [backups]);

  const current = backups.find((backup) => backup.uuid === selected) ?? null;
  const days = Math.round((end - start) / DAY);

  const doDownload = (backup: Backup) => {
    const pending = addPendingToast('Download wird vorbereitet …');
    downloadBackup(server.uuid, backup.uuid, 'tar_gz')
      .then(({ url }) => {
        pending.settle('Download gestartet.', 'success');
        downloadUrl(url, () => addToast('Download fehlgeschlagen.', 'error'));
      })
      .catch((error) => pending.settle(httpErrorToHuman(error), 'error'));
  };

  if (backups.length === 0) return null;

  return (
    <section className='taxz-btl' aria-label='Backups als Zeitleiste'>
      <div className='taxz-btl-head'>
        <h2 className='taxz-btl-title'>Zeitleiste</h2>
        <span className='taxz-btl-range'>Letzte {days} Tage</span>
      </div>
      <div className='taxz-btl-track' style={{ '--lvls': levels } as React.CSSProperties}>
        <span className='taxz-btl-line' aria-hidden='true' />
        {dots.length === 0 && <span className='taxz-btl-empty'>Keine Backups in diesem Zeitraum.</span>}
        {dots.map(({ backup, x, level }) => {
          const state = stateOf(backup);
          return (
            <button
              key={backup.uuid}
              type='button'
              className={classNames('taxz-btl-dot', `is-${state.tone}`, selected === backup.uuid && 'is-on')}
              style={{ left: `${x}%`, '--lvl': level } as React.CSSProperties}
              aria-pressed={selected === backup.uuid}
              aria-label={`${backup.name}, ${dateTime.format(backup.created)}, ${state.label}`}
              title={`${backup.name} · ${dateTime.format(backup.created)}`}
              onClick={() => setSelected(selected === backup.uuid ? null : backup.uuid)}
            />
          );
        })}
      </div>
      <div className='taxz-btl-scale' aria-hidden='true'>
        <span>{shortDate.format(start)}</span>
        <span>{shortDate.format(start + (end - start) / 2)}</span>
        <span>heute</span>
      </div>

      {current && (
        <div className='taxz-btl-card' role='region' aria-label={`Backup ${current.name}`}>
          <div className='taxz-btl-info'>
            <b>{current.name}</b>
            <dl className='taxz-btl-kv'>
              <dt>Erstellt</dt>
              <dd>{dateTime.format(current.created)}</dd>
              <dt>Größe</dt>
              <dd className='taxz-mono'>{current.completed ? bytes(current.bytes) : '–'}</dd>
              <dt>Art</dt>
              <dd>{current.kind === 'server' ? 'Server-Backup' : 'Datenbank-Backup'}</dd>
              <dt>Status</dt>
              <dd>{stateOf(current).label}</dd>
            </dl>
          </div>
          {stateOf(current).tone === 'ok' && (
            <div className='taxz-btl-acts'>
              {canDownload && (
                <button type='button' className='taxz-btn' onClick={() => doDownload(current)}>
                  <FontAwesomeIcon icon={faFileArrowDown} aria-hidden='true' />
                  Herunterladen
                </button>
              )}
              {canRestore && (
                <button type='button' className='taxz-btn taxz-btn-danger' onClick={() => setRestoring(true)}>
                  <FontAwesomeIcon icon={faRotateLeft} aria-hidden='true' />
                  Wiederherstellen
                </button>
              )}
            </div>
          )}
          {current.kind === 'server' ? (
            <BackupRestoreModal backup={current} opened={restoring} onClose={() => setRestoring(false)} />
          ) : (
            <DatabaseInstanceBackupRestoreModal backup={current} opened={restoring} onClose={() => setRestoring(false)} />
          )}
        </div>
      )}
    </section>
  );
}

export function registerBackupTimeline(ctx: ExtensionContext) {
  ctx.extensionRegistry.enterPages((pages) => {
    pages.server.backups.container.prependedContentComponents.push(BackupTimeline);
  });
}
