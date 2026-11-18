// Ersetzt die Serverkarte der Serverliste (Designvorgabe 7.1, Idee 19). Mit "Standard" wird die Originalkarte gerendert.
// Funktionen wie im Original: Auswahl (auch mit gehaltener S-Taste), Kontextmenue mit Start/Neustart/Stopp/Beenden,
// Gruppe hinzufuegen/entfernen, Adresse kopieren, Hinweis auf fremde Server. Dazu Start/Stopp direkt auf der Karte.
// Die Leiste zeigt nach 7.1 nur Oeffnen, Start/Stopp und das Menue; Gruppe hinzufuegen/entfernen stehen im Menue (auch per
// Rechtsklick), die Auswahl ist ein Haekchen in der Ecke, sichtbar bei Hover/Fokus, bei aktiver Auswahl und auf Touch-Geraeten.

import {
  faCheck,
  faCopy,
  faEllipsisVertical,
  faMinus,
  faPlay,
  faPlus,
  faPowerOff,
  faRotateRight,
  faSkull,
  faStop,
  faTerminal,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { type ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { formatAllocation } from '@/lib/domain/server.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import OriginalServerItem from '@/pages/dashboard/home/ServerItem.tsx';
import ServerAddGroupModal from '@/pages/dashboard/home/modals/ServerAddGroupModal.tsx';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { useServerStats, useServerStatsUnavailable } from '@/plugins/server/useServerStats.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import { ago, crashCause, useOpenCrash } from './CrashHelp.tsx';
import { gameLook } from './games.ts';
import { pushLive, useResourceSeries } from './history.ts';
import { useIsTaxz, useThemePrefs } from './prefs.ts';
import { ServerArtLayer, ServerEmblem } from './ServerArt.tsx';
import { useServerImage } from './serverImages.ts';
import Sparkline from './Sparkline.tsx';
import { bytesShort, isActive, num, reportVisibleServer, statusOf, type Tone } from './serverStatus.ts';
import { useTween } from './useTween.ts';

type Props = ComponentProps<typeof OriginalServerItem>;

export function StatusPill({ tone, label, onArt = false }: { tone: Tone; label: string; onArt?: boolean }) {
  return (
    <span className={classNames('taxz-pill', `taxz-tone-${tone}`, onArt && 'taxz-pill-art')}>
      <span className='taxz-dot' aria-hidden='true' />
      {label}
    </span>
  );
}

function Meter({ value }: { value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <span className={classNames('taxz-meter', pct > 90 && 'is-high')} aria-hidden='true'>
      <b style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Startvorgang auf der Karte (Idee 6): verstrichene Zeit seit Start. Die letzte Konsolenzeile gibt es nur auf der Serverseite,
 * weil die Serverliste keine Konsole mitliest. */
function CardStarting({ uptimeMs }: { uptimeMs: number }) {
  const [since] = useState(() => Date.now() - uptimeMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <p className='taxz-sc-note taxz-sc-starting'>
      {/* Der Sekundenzaehler wird nicht vorgelesen; der Status "Startet" steht schon in der Karte. */}
      <span aria-hidden='true'>
        Startet seit {seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} Min ${seconds % 60} s`}
      </span>
    </p>
  );
}

function TaxzServerItem(props: Props) {
  const {
    server,
    to,
    showGroupAddButton = false,
    showForeignServerBadge = false,
    showContextMenu = false,
    onGroupRemove,
    isSelected = false,
    onSelectionChange,
    onClick,
    showSelection = true,
    sKeyPressedRef,
  } = props;

  const [prefs] = useThemePrefs();
  const { user } = useAuth();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const stats = useServerStats(server);
  const statsUnavailable = useServerStatsUnavailable(server);
  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();
  const [openModal, setOpenModal] = useState<'add-group' | 'kill' | 'stop' | null>(null);

  const state = stats?.state ?? null;
  const canReadConsole = server.permissions.includes('*') || server.permissions.includes('control.read-console') || (user?.role?.serverPermissions ?? []).includes('control.read-console');
  const crash = useOpenCrash(server.uuid, state, canReadConsole && !server.status && !server.isSuspended && !server.isTransferring);
  const status = crash ? { tone: 'bad' as const, label: 'Abgestürzt' } : statusOf(server, state);
  const look = useMemo(() => gameLook(server.egg), [server.egg]);
  const image = useServerImage(server.uuid);
  const href = to ?? `/server/${server.uuidShort}`;
  const address = server.allocation ? formatAllocation(server.allocation) : null;

  useEffect(() => reportVisibleServer(server.uuid, isActive(state)), [server.uuid, state]);
  useEffect(() => pushLive(server.uuid, stats), [server.uuid, stats]);
  const series = useResourceSeries(prefs.serverView === 'cards' ? server.uuid : null);
  const sparkTimes = useMemo(() => series.map((sample) => sample.t), [series]);

  const powerBlocked = !!server.status || server.isSuspended || server.isTransferring || server.nodeMaintenanceEnabled;
  const permissionSet = useMemo(
    () => new Set([...server.permissions, ...(user?.role?.serverPermissions ?? [])]),
    [server.permissions, user?.role?.serverPermissions],
  );
  const canPower = useCallback(
    (action: string) => permissionSet.has('*') || permissionSet.has(action),
    [permissionSet],
  );
  const doPowerAction = useCallback(
    (action: z.infer<typeof serverPowerAction>) => handleBulkPowerAction([server.uuid], action),
    [handleBulkPowerAction, server.uuid],
  );
  const availableGroups = useMemo(
    () => serverGroups.filter((group) => !group.serverOrder.includes(server.uuid)),
    [serverGroups, server.uuid],
  );

  const menuItems: ContextMenuItem[] = useMemo(
    () => [
      {
        type: 'action' as const,
        icon: faPlay,
        label: 'Starten',
        canAccess: canPower('control.start'),
        disabled: powerBlocked || bulkActionLoading !== null || state !== 'offline',
        onClick: () => doPowerAction('start'),
      },
      {
        type: 'action' as const,
        icon: faRotateRight,
        label: 'Neu starten',
        canAccess: canPower('control.restart'),
        disabled: powerBlocked || bulkActionLoading !== null || !state,
        onClick: () => doPowerAction('restart'),
      },
      {
        type: 'action' as const,
        icon: faStop,
        label: 'Stoppen',
        color: 'red' as const,
        canAccess: canPower('control.stop'),
        disabled: powerBlocked || bulkActionLoading !== null || !state || state === 'offline',
        onClick: () => setOpenModal('stop'),
      },
      {
        type: 'action' as const,
        icon: faSkull,
        label: 'Sofort beenden',
        color: 'red' as const,
        hidden: state !== 'stopping',
        canAccess: canPower('control.stop'),
        disabled: powerBlocked || bulkActionLoading !== null,
        onClick: () => setOpenModal('kill'),
      },
      {
        type: 'divider' as const,
        hidden:
          (!showGroupAddButton && !onGroupRemove) ||
          !(canPower('control.start') || canPower('control.restart') || canPower('control.stop')),
      },
      {
        type: 'action' as const,
        icon: faPlus,
        label: availableGroups.length === 0 ? 'Zu Gruppe hinzufügen (keine frei)' : 'Zu Gruppe hinzufügen',
        hidden: !showGroupAddButton,
        disabled: availableGroups.length === 0,
        onClick: () => setOpenModal('add-group'),
      },
      {
        type: 'action' as const,
        icon: faMinus,
        label: 'Aus Gruppe entfernen',
        color: 'red' as const,
        hidden: !onGroupRemove,
        onClick: () => onGroupRemove?.(),
      },
    ],
    [canPower, powerBlocked, bulkActionLoading, state, doPowerAction, showGroupAddButton, onGroupRemove, availableGroups.length],
  );

  const cpuLimit = server.limits.cpu || 0;
  const cpuMax = cpuLimit || stats?.cpuLimitAbsolute || 100;
  const memMax = server.limits.memory ? server.limits.memory * 1024 * 1024 : stats?.memoryLimitBytes || 0;
  const diskMax = server.limits.disk ? server.limits.disk * 1024 * 1024 : 0;
  const running = state !== null && state !== 'offline';
  const noStats = !stats;
  // Weich laufende Zahlen (Idee 5); bei "Bewegung reduzieren" springen sie.
  const cpuNow = useTween(running && stats ? stats.cpuAbsolute : 0);
  const memNow = useTween(running && stats ? stats.memoryBytes : 0);
  const diskNow = useTween(stats?.diskBytes ?? 0);

  const metrics = [
    {
      key: 'cpu',
      label: 'CPU',
      value: running && stats ? `${num(cpuNow, 0)} %` : '–',
      max: running && cpuLimit ? `${cpuLimit} %` : '',
      pct: running && stats ? (stats.cpuAbsolute / cpuMax) * 100 : null,
      spark: series.map((sample) => sample.cpu),
      sparkMax: cpuLimit || undefined,
    },
    {
      key: 'ram',
      label: 'RAM',
      value: running && stats ? bytesShort(memNow) : '–',
      max: running && memMax ? bytesShort(memMax) : '',
      pct: running && stats && memMax ? (stats.memoryBytes / memMax) * 100 : null,
      spark: series.map((sample) => sample.mem),
      sparkMax: memMax || undefined,
    },
    {
      key: 'disk',
      label: 'Speicher',
      value: stats ? bytesShort(diskNow) : '–',
      max: stats && diskMax ? bytesShort(diskMax) : '',
      pct: stats && diskMax ? (stats.diskBytes / diskMax) * 100 : null,
      spark: null,
      sparkMax: undefined,
    },
  ];

  const powerButton = (() => {
    if (powerBlocked) return null;
    if (state === 'offline' && canPower('control.start')) {
      return (
        <Tooltip label={`${server.name} starten`}>
          <button
            type='button'
            className='taxz-btn taxz-btn-icon taxz-btn-start'
            aria-label={`${server.name} starten`}
            disabled={bulkActionLoading !== null}
            onClick={() => doPowerAction('start')}
          >
            <FontAwesomeIcon icon={faPlay} />
          </button>
        </Tooltip>
      );
    }
    if ((state === 'running' || state === 'starting') && canPower('control.stop')) {
      return (
        <Tooltip label={`${server.name} stoppen`}>
          <button
            type='button'
            className='taxz-btn taxz-btn-icon taxz-btn-danger'
            aria-label={`${server.name} stoppen`}
            disabled={bulkActionLoading !== null}
            onClick={() => setOpenModal('stop')}
          >
            <FontAwesomeIcon icon={faPowerOff} />
          </button>
        </Tooltip>
      );
    }
    if (state === 'stopping' && canPower('control.stop')) {
      return (
        <Tooltip label={`${server.name} sofort beenden`}>
          <button
            type='button'
            className='taxz-btn taxz-btn-icon taxz-btn-danger'
            aria-label={`${server.name} sofort beenden`}
            onClick={() => setOpenModal('kill')}
          >
            <FontAwesomeIcon icon={faSkull} />
          </button>
        </Tooltip>
      );
    }
    return null;
  })();

  const linkClick = (event: React.MouseEvent) => {
    if (sKeyPressedRef?.current) event.preventDefault();
  };

  const selectBox = showSelection && onSelectionChange && (
    <Tooltip label={isSelected ? 'Auswahl aufheben' : 'Auswählen'} unwrapped>
      <button
        type='button'
        className={classNames('taxz-sel', isSelected && 'is-on')}
        aria-pressed={isSelected}
        aria-label={isSelected ? `${server.name} abwählen` : `${server.name} auswählen`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectionChange(!isSelected);
        }}
      >
        <FontAwesomeIcon icon={faCheck} />
      </button>
    </Tooltip>
  );

  const menuButton = (openMenu: (x: number, y: number) => void, items: ContextMenuItem[]) => (
    <>
      {showContextMenu && items.some((item) => !item.hidden && item.canAccess !== false) && (
        <Tooltip label='Weitere Aktionen'>
          <button
            type='button'
            className='taxz-btn taxz-btn-icon'
            aria-label={`Weitere Aktionen für ${server.name}`}
            aria-haspopup='menu'
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              openMenu(rect.left, rect.bottom);
            }}
          >
            <FontAwesomeIcon icon={faEllipsisVertical} />
          </button>
        </Tooltip>
      )}
    </>
  );

  const foreign = showForeignServerBadge && !server.isOwner && (
    <Tooltip label='Server eines anderen Benutzers'>
      <FontAwesomeIcon icon={faUsers} className='taxz-foreign' aria-label='Server eines anderen Benutzers' />
    </Tooltip>
  );

  const addressEl = address ? (
    <span className='taxz-addr'>
      <span className='taxz-mono'>
        <RedactedText value={address} />
      </span>
      <CopyOnClick content={address} className='taxz-ib'>
        <span className='taxz-sr'>Adresse kopieren</span>
        <FontAwesomeIcon icon={faCopy} aria-hidden='true' />
      </CopyOnClick>
    </span>
  ) : (
    <span className='taxz-addr taxz-muted'>Keine Adresse</span>
  );

  return (
    <>
      <ServerAddGroupModal server={server} opened={openModal === 'add-group'} onClose={() => setOpenModal(null)} />
      <ConfirmationModal
        opened={openModal === 'stop'}
        onClose={() => setOpenModal(null)}
        title={`${server.name} stoppen?`}
        confirm='Stoppen'
        onConfirmed={() => {
          setOpenModal(null);
          return doPowerAction('stop');
        }}
      >
        Der Server fährt herunter, alle Verbindungen zum Spiel werden getrennt.
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'kill'}
        onClose={() => setOpenModal(null)}
        title={`${server.name} sofort beenden?`}
        confirm='Sofort beenden'
        onConfirmed={() => {
          setOpenModal(null);
          return doPowerAction('kill');
        }}
      >
        Der Server wird ohne Speichern abgebrochen. Nicht gespeicherte Spielstände gehen verloren.
      </ConfirmationModal>

      <ContextMenu enabled={showContextMenu} items={menuItems}>
        {({ items, openMenu }) =>
          prefs.serverView === 'list' ? (
            <div
              className={classNames('taxz-sc-wrap taxz-srow', `taxz-tone-${status.tone}`, isSelected && 'is-selected')}
              onClick={onClick}
              onContextMenu={(event) => {
                if (!showContextMenu) return;
                event.preventDefault();
                openMenu(event.clientX, event.clientY);
              }}
            >
              <span className='taxz-dot' aria-hidden='true' />
              <ServerEmblem look={look} size='sm' image={image} />
              <div className='taxz-srow-name'>
                <NavLink to={href} className='taxz-stretch' onClick={linkClick}>
                  {server.name}
                </NavLink>
                {foreign}
                <span className='taxz-sr'>, {status.label}</span>
              </div>
              <span className='taxz-srow-status'>{status.label}</span>
              <span className='taxz-srow-addr'>{addressEl}</span>
              <span className='taxz-srow-num'>
                <span>CPU</span> {metrics[0].value}
              </span>
              <span className='taxz-srow-num'>
                <span>RAM</span> {metrics[1].value}
              </span>
              <div className='taxz-srow-acts'>
                {selectBox}
                {powerButton}
                {menuButton(openMenu, items)}
              </div>
            </div>
          ) : (
            <article
              className={classNames(
                'taxz-sc-wrap taxz-sc',
                `taxz-tone-${status.tone}`,
                running ? 'is-on' : 'is-off',
                isSelected && 'is-selected',
              )}
              onClick={onClick}
              onContextMenu={(event) => {
                if (!showContextMenu) return;
                event.preventDefault();
                openMenu(event.clientX, event.clientY);
              }}
            >
              <div className={classNames('taxz-sc-art', `taxz-art-${prefs.art}`)}>
                <ServerArtLayer look={look} art={prefs.art} seedText={server.uuid} image={image} />
                <span className='taxz-sc-tag'>{look.label}</span>
                <StatusPill tone={status.tone} label={status.label} onArt />
              </div>
              <div className='taxz-sc-body'>
                <ServerEmblem look={look} image={image} />
                {selectBox}
                <div className='taxz-sc-title'>
                  <h3>
                    <NavLink to={href} className='taxz-stretch' onClick={linkClick}>
                      {server.name}
                    </NavLink>
                    {foreign}
                  </h3>
                  <div className='taxz-sc-meta'>
                    {addressEl}
                    <span className='taxz-sc-egg'>{server.egg.name}</span>
                  </div>
                </div>
                {state === 'starting' && <CardStarting uptimeMs={stats?.uptime ?? 0} />}
                {crash && (
                  <p className='taxz-sc-note taxz-sc-crash' role='status'>
                    Abgestürzt {ago(crash.timestamp)} · {crashCause(crash, undefined).short}
                  </p>
                )}
                {noStats && statsUnavailable ? (
                  <p className='taxz-sc-note'>Werte gerade nicht abrufbar (Node nicht erreichbar).</p>
                ) : (
                  <div className='taxz-stats3'>
                    {metrics.map((metric) => (
                      <div className='taxz-stat' key={metric.key}>
                        <span>{metric.label}</span>
                        <b>
                          {metric.value}
                          {metric.max && <small> / {metric.max}</small>}
                        </b>
                        <Meter value={metric.pct} />
                        {metric.spark && <Sparkline values={metric.spark} times={sparkTimes} max={metric.sparkMax} className='taxz-stat-spark' />}
                      </div>
                    ))}
                  </div>
                )}
                <div className='taxz-sc-acts'>
                  <NavLink to={href} className='taxz-btn taxz-btn-tonal taxz-sc-open' onClick={linkClick} tabIndex={-1}>
                    <FontAwesomeIcon icon={faTerminal} />
                    <span className='taxz-sc-open-txt'>Öffnen</span>
                  </NavLink>
                  {powerButton}
                  {menuButton(openMenu, items)}
                </div>
              </div>
            </article>
          )
        }
      </ContextMenu>
    </>
  );
}

export default function ServerItem(props: Props) {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzServerItem {...props} /> : <OriginalServerItem {...props} />;
}
