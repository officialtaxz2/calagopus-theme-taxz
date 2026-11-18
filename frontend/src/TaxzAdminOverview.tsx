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
import { getExtTranslations, useExtTranslations } from './translations.ts';


const PERIODS = ['today', 'week', 'month', 'allTime'] as const;

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
  const { t } = useExtTranslations();

  return (
    <div className='taxz-admin'>
      <PanelUpdateAlert />
      <ExtensionBuildFailedAlert />
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.prependedComponents}
        name='overview-prepended'
      />

      {!canReadStats ? (
        <p className='taxz-empty-line'>{t('adminOverview.noPermission', {})}</p>
      ) : (
        <>
          <ResourceView resource={general}>
            {(stats) => (
              <div className='taxz-akpis'>
                <Kpi icon={faComputer} value={String(stats.servers)} label={t('adminOverview.kpi.servers', {})} to='/admin/servers' />
                <Kpi icon={faUsers} value={String(stats.users)} label={t('adminOverview.kpi.users', {})} to='/admin/users' />
                <Kpi icon={faServer} value={String(stats.nodes)} label={t('adminOverview.kpi.nodes', {})} to='/admin/nodes' />
                <ResourceView resource={overview}>
                  {(system) => (
                    <Kpi icon={faCodeBranch} value={system.version} label={t('adminOverview.kpi.version', {})} to='/admin/updates' />
                  )}
                </ResourceView>
                <Kpi icon={faEarth} value={String(stats.locations)} label={t('adminOverview.kpi.locations', {})} to='/admin/locations' />
                <Kpi icon={faEgg} value={String(stats.nestEggs)} label={t('adminOverview.kpi.eggs', {})} to='/admin/nests' />
                <Kpi
                  icon={faDatabase}
                  value={String(stats.databaseHosts)}
                  label={t('adminOverview.kpi.databaseHosts', {})}
                  to='/admin/database-hosts'
                />
                <Kpi icon={faScroll} value={String(stats.roles)} label={t('adminOverview.kpi.roles', {})} to='/admin/roles' />
              </div>
            )}
          </ResourceView>

          <div className='taxz-admin-grid'>
            <ResourceView resource={overview}>
              {(system) => {
                const memPct = system.memory.totalBytes ? (system.memory.usedBytes / system.memory.totalBytes) * 100 : 0;
                const hitPct = system.cache.totalCalls ? (system.cache.totalHits / system.cache.totalCalls) * 100 : 0;
                return (
                  <Panel icon={faMicrochip} title={t('adminOverview.system.title', {})} aside={`Calagopus ${system.version}`}>
                    <dl className='taxz-rows'>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faMicrochip} aria-hidden='true' /> {t('adminOverview.system.cpu', {})}
                        </dt>
                        <dd>
                          {system.cpu.brand} · {t('adminOverview.system.threads', { count: system.cpu.cpuCount })}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faMemory} aria-hidden='true' /> {t('adminOverview.system.memory', {})}
                        </dt>
                        <dd>
                          {bytes(system.memory.usedBytes)} / {bytes(system.memory.totalBytes)}
                          <span className='taxz-meter' aria-hidden='true'>
                            <b style={{ width: `${Math.min(100, memPct)}%` }} />
                          </span>
                          <small>{t('adminOverview.system.panelMemory', { size: bytes(system.memory.usedBytesProcess) })}</small>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faTerminal} aria-hidden='true' /> {t('adminOverview.system.kernel', {})}
                        </dt>
                        <dd className='taxz-mono'>
                          {system.kernelVersion} ({system.architecture})
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faBoxArchive} aria-hidden='true' /> {t('adminOverview.system.installation', {})}
                        </dt>
                        <dd>{containerLabel(system.containerType)}</dd>
                      </div>
                      <div>
                        <dt>
                          <FontAwesomeIcon icon={faDatabase} aria-hidden='true' /> {t('adminOverview.system.database', {})}
                        </dt>
                        <dd>
                          PostgreSQL {system.database.version} · {bytes(system.database.sizeBytes)}
                        </dd>
                      </div>
                    </dl>
                    <div className='taxz-mini4'>
                      <div>
                        <span>{t('adminOverview.cache.calls', {})}</span>
                        <b>{num(system.cache.totalCalls, 0)}</b>
                      </div>
                      <div>
                        <span>{t('adminOverview.cache.hits', {})}</span>
                        <b>{num(hitPct, 0)} %</b>
                      </div>
                      <div>
                        <span>{t('adminOverview.cache.misses', {})}</span>
                        <b>{num(system.cache.totalMisses, 0)}</b>
                      </div>
                      <div>
                        <span>{t('adminOverview.cache.slowest', {})}</span>
                        <b>{num(system.cache.maxCallLatencyNs / 1e6, 1)} ms</b>
                      </div>
                    </div>
                  </Panel>
                );
              }}
            </ResourceView>

            <ResourceView resource={backups}>
              {(stats) => (
                <Panel icon={faArchive} title={t('adminOverview.backups.title', {})} aside={t('adminOverview.backups.allServers', {})}>
                  <div className='taxz-table-wrap' tabIndex={0} role='region' aria-label={t('adminOverview.backups.label', {})}>
                    <table className='taxz-table'>
                      <thead>
                        <tr>
                          <th scope='col'>{t('adminOverview.backups.period', {})}</th>
                          <th scope='col'>{t('adminOverview.backups.total', {})}</th>
                          <th scope='col'>{t('adminOverview.backups.successful', {})}</th>
                          <th scope='col'>{t('adminOverview.backups.failed', {})}</th>
                          <th scope='col'>{t('adminOverview.backups.deleted', {})}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERIODS.map((period) => {
                          const row = stats[period];
                          return (
                            <tr key={period}>
                              <th scope='row'>{t(`adminOverview.periods.${period}`, {})}</th>
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
  const { t } = getExtTranslations();
  switch (type) {
    case 'none':
      return t('adminOverview.container.none', {});
    case 'official':
      return t('adminOverview.container.official', {});
    case 'official_aio':
      return t('adminOverview.container.officialAio', {});
    case 'official_heavy':
      return t('adminOverview.container.officialHeavy', {});
    case 'official_heavy_aio':
      return t('adminOverview.container.officialHeavyAio', {});
    default:
      return t('status.unknown', {});
  }
}


export default function AdminOverview() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzAdminOverview /> : <OriginalAdminOverview />;
}
