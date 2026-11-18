// Admin-Uebersicht im taxz-Theme (Designvorgabe 7.6): statt vieler gleich blauer Kacheln ein Kopf mit Kennzahlen
// (Server, Benutzer, Nodes, Version ...) und darunter Karten nach den Navigationsgruppen. Dieselben Daten und Rechte wie im
// Standard-Panel (stats.read), Hinweise auf Updates und fehlgeschlagene Erweiterungs-Bauten bleiben. Mit "Standard" das Original.

import {
  faArchive,
  faBoxArchive,
  faCodeBranch,
  faComputer,
  faDatabase,
  faEarth,
  faEgg,
  faMemory,
  faMicrochip,
  faScroll,
  faServer,
  faTerminal,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import getBackupStats from '@/api/admin/stats/getBackupStats.ts';
import getGeneralStats from '@/api/admin/stats/getGeneralStats.ts';
import getOverview from '@/api/admin/system/getOverview.ts';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import ExtensionBuildFailedAlert from '@/pages/admin/home/ExtensionBuildFailedAlert.tsx';
import OriginalAdminOverview from '@/pages/admin/home/overview/AdminOverview.tsx';
import PanelUpdateAlert from '@/pages/admin/home/PanelUpdateAlert.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useIsTaxz } from './prefs.ts';
import { bytes, num } from './serverStatus.ts';

const PERIODS = [
  { key: 'today', label: 'Heute' },
  { key: 'week', label: 'Diese Woche' },
  { key: 'month', label: 'Dieser Monat' },
  { key: 'allTime', label: 'Gesamt' },
] as const;

function Kpi({ icon, value, label, to }: { icon: IconDefinition; value: string; label: string; to?: string }) {
  const body = (
    <>
      <span className='taxz-akpi-ic' aria-hidden='true'>
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className='taxz-akpi-txt'>
        <b>{value}</b>
        <span>{label}</span>
      </span>
    </>
  );
  return to ? (
    <NavLink to={to} className='taxz-akpi'>
      {body}
    </NavLink>
  ) : (
    <div className='taxz-akpi'>{body}</div>
  );
}

function Panel({ icon, title, aside, children }: { icon: IconDefinition; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className='taxz-sect'>
      <h2 className='taxz-sect-title'>
        <FontAwesomeIcon icon={icon} aria-hidden='true' />
        {title}
        {aside && <span className='taxz-sect-aside'>{aside}</span>}
      </h2>
      <div className='taxz-sect-body'>{children}</div>
    </section>
  );
}

function TaxzAdminOverview() {
  const canReadStats = useAdminCan('stats.read');
  const overview = useResource({ queryKey: queryKeys.admin.system.overview(), queryFn: getOverview, enabled: canReadStats });
  const general = useResource({ queryKey: queryKeys.admin.stats.general(), queryFn: getGeneralStats, enabled: canReadStats });
  const backups = useResource({ queryKey: queryKeys.admin.stats.backups(), queryFn: getBackupStats, enabled: canReadStats });

  return (
    <div className='taxz-admin'>
      <PanelUpdateAlert />
      <ExtensionBuildFailedAlert />
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.prependedComponents}
        name='overview-prepended'
      />

      {!canReadStats ? (
        <p className='taxz-empty-line'>Für die Übersicht fehlt dir das Recht „Statistiken lesen“.</p>
      ) : (
        <>
          <ResourceView resource={general}>
            {(stats) => (
              <div className='taxz-akpis'>
                <Kpi icon={faComputer} value={String(stats.servers)} label='Server' to='/admin/servers' />
                <Kpi icon={faUsers} value={String(stats.users)} label='Benutzer' to='/admin/users' />
                <Kpi icon={faServer} value={String(stats.nodes)} label='Nodes' to='/admin/nodes' />
                <ResourceView resource={overview}>
                  {(system) => <Kpi icon={faCodeBranch} value={system.version} label='Panel-Version' to='/admin/updates' />}
                </ResourceView>
                <Kpi icon={faEarth} value={String(stats.locations)} label='Standorte' to='/admin/locations' />
                <Kpi icon={faEgg} value={String(stats.nestEggs)} label='Eggs' to='/admin/nests' />
                <Kpi icon={faDatabase} value={String(stats.databaseHosts)} label='Datenbank-Hosts' to='/admin/database-hosts' />
                <Kpi icon={faScroll} value={String(stats.roles)} label='Rollen' to='/admin/roles' />
              </div>
            )}
          </ResourceView>

          <div className='taxz-admin-grid'>
            <ResourceView resource={overview}>
              {(system) => {
                const memPct = system.memory.totalBytes ? (system.memory.usedBytes / system.memory.totalBytes) * 100 : 0;
                const hitPct = system.cache.totalCalls ? (system.cache.totalHits / system.cache.totalCalls) * 100 : 0;
                return (
                  <Panel icon={faMicrochip} title='System' aside={`Calagopus ${system.version}`}>
                    <dl className='taxz-rows'>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faMicrochip} aria-hidden='true' /> Prozessor
                        </dt>
                        <dd>
                          {system.cpu.brand} · {system.cpu.cpuCount} Threads
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faMemory} aria-hidden='true' /> Arbeitsspeicher
                        </dt>
                        <dd>
                          {bytes(system.memory.usedBytes)} / {bytes(system.memory.totalBytes)}
                          <span className='taxz-meter' aria-hidden='true'>
                            <b style={{ width: `${Math.min(100, memPct)}%` }} />
                          </span>
                          <small>Panel selbst: {bytes(system.memory.usedBytesProcess)}</small>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faTerminal} aria-hidden='true' /> Kernel
                        </dt>
                        <dd className='taxz-mono'>
                          {system.kernelVersion} ({system.architecture})
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faBoxArchive} aria-hidden='true' /> Installation
                        </dt>
                        <dd>{containerLabel(system.containerType)}</dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faDatabase} aria-hidden='true' /> Datenbank
                        </dt>
                        <dd>
                          PostgreSQL {system.database.version} · {bytes(system.database.sizeBytes)}
                        </dd>
                      </div>
                    </dl>
                    <div className='taxz-mini4'>
                      <div>
                        <span>Cache-Aufrufe</span>
                        <b>{num(system.cache.totalCalls, 0)}</b>
                      </div>
                      <div>
                        <span>Treffer</span>
                        <b>{num(hitPct, 0)} %</b>
                      </div>
                      <div>
                        <span>Fehlversuche</span>
                        <b>{num(system.cache.totalMisses, 0)}</b>
                      </div>
                      <div>
                        <span>Langsamster</span>
                        <b>{num(system.cache.maxCallLatencyNs / 1e6, 1)} ms</b>
                      </div>
                    </div>
                  </Panel>
                );
              }}
            </ResourceView>

            <ResourceView resource={backups}>
              {(stats) => (
                <Panel icon={faArchive} title='Backups' aside='alle Server'>
                  <div className='taxz-table-wrap' tabIndex={0} role='region' aria-label='Backups nach Zeitraum'>
                    <table className='taxz-table'>
                      <thead>
                        <tr>
                          <th scope='col'>Zeitraum</th>
                          <th scope='col'>Gesamt</th>
                          <th scope='col'>Erfolgreich</th>
                          <th scope='col'>Fehlgeschl.</th>
                          <th scope='col'>Gelöscht</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERIODS.map((period) => {
                          const row = stats[period.key];
                          return (
                            <tr key={period.key}>
                              <th scope='row'>{period.label}</th>
                              <td>{row.total}</td>
                              <td>
                                <span className='taxz-ok'>{row.successful}</span>
                                <small>{bytes(row.successfulBytes)}</small>
                              </td>
                              <td className={row.failed ? 'taxz-bad' : undefined}>{row.failed}</td>
                              <td>
                                {row.deleted}
                                {row.deleted > 0 && <small>{bytes(row.deletedBytes)}</small>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </ResourceView>
          </div>
        </>
      )}

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.appendedComponents}
        name='overview-appended'
      />
    </div>
  );
}

function containerLabel(type: string) {
  switch (type) {
    case 'none':
      return 'Ohne Container';
    case 'official':
      return 'Offiziell';
    case 'official_aio':
      return 'Offiziell (AIO)';
    case 'official_heavy':
      return 'Offiziell (Heavy)';
    case 'official_heavy_aio':
      return 'Offiziell (Heavy AIO)';
    default:
      return 'Unbekannt';
  }
}

export default function AdminOverview() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzAdminOverview /> : <OriginalAdminOverview />;
}
