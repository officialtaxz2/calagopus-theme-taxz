// Konsolen-Seite im taxz-Theme (Designvorgabe 7.3): Kennzahl-Kacheln CPU, RAM, Speicher, Netzwerk mit weich laufenden Zahlen
// (Idee 5) und Verlaufskurven der letzten Stunde (Idee 4), darunter die Konsole des Panels. Name und Ein/Aus-Knoepfe stehen im
// Server-Kopf (ServerHead). Jede Kachel fuehrt zu den ausfuehrlichen Diagrammen des Panels (Navigationspunkt "Ressourcen").
// Mit "Standard" das Original.

import {
  faArrowRightArrowLeft,
  faChevronRight,
  faHardDrive,
  faMemory,
  faMicrochip,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { useNavbarPageHeader } from '@/elements/containers/useNavbarPageHeader.ts';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import OriginalServerConsole from '@/pages/server/console/ServerConsole.tsx';
import Console from '@/pages/server/console/terminal/Console.tsx';
import { useVisualViewportBottomInset } from '@/plugins/viewport/useVisualViewport.ts';
import { useServerStore } from '@/stores/server.ts';
import { pushLive, useResourceSeries } from './history.ts';
import { useIsTaxz } from './prefs.ts';
import { bytes, num } from './serverStatus.ts';
import Sparkline from './Sparkline.tsx';
import { useExtTranslations } from './translations.ts';
import { useTween } from './useTween.ts';

function Tile({
  icon,
  label,
  value,
  max,
  pct,
  spark,
  sparkTimes,
  sparkMax,
  detail,
  to,
}: {
  to: string;
  icon: FontAwesomeIconProps['icon'];
  label: string;
  value: string;
  max?: string;
  pct?: number | null;
  spark?: (number | null)[];
  sparkTimes?: number[];
  sparkMax?: number;
  detail?: string;
}) {
  const fill = pct === null || pct === undefined ? null : Math.max(0, Math.min(100, pct));
  const { t } = useExtTranslations();
  return (
    <div className='taxz-kpi'>
      <div className='taxz-kpi-top'>
        <span className='taxz-kpi-ic' aria-hidden='true'>
          <FontAwesomeIcon icon={icon} />
        </span>
        <span className='taxz-kpi-label'>{label}</span>
        {/* Ganze Kachel klickbar (Link ueber die Flaeche gespannt); Name fuer Screenreader ohne die laufend wechselnden Zahlen */}
        <Link to={to} className='taxz-stretch taxz-kpi-go' title={t('consolePage.history', {})}>
          <span className='taxz-sr'>{t('consolePage.historyLabel', { label })}</span>
          <FontAwesomeIcon icon={faChevronRight} aria-hidden='true' />
        </Link>
      </div>
      <b className='taxz-kpi-val'>
        {value}
        {max && <small> / {max}</small>}
      </b>
      {detail && <span className='taxz-kpi-detail'>{detail}</span>}
      {fill !== null && (
        <span className={classNames('taxz-meter', fill > 90 && 'is-high')} aria-hidden='true'>
          <b style={{ width: `${fill}%` }} />
        </span>
      )}
      {spark && <Sparkline values={spark} times={sparkTimes} max={sparkMax} className='taxz-kpi-spark' />}
    </div>
  );
}

function useNetworkRate(rx: number | undefined, tx: number | undefined) {
  const last = useRef<{ t: number; rx: number; tx: number } | null>(null);
  const [rate, setRate] = useState({ rx: 0, tx: 0 });
  useEffect(() => {
    if (rx === undefined || tx === undefined) return;
    const now = Date.now();
    const prev = last.current;
    if (prev && now - prev.t >= 500) {
      const seconds = (now - prev.t) / 1000;
      setRate({ rx: Math.max(0, (rx - prev.rx) / seconds), tx: Math.max(0, (tx - prev.tx) / seconds) });
    }
    if (!prev || now - prev.t >= 500) last.current = { t: now, rx, tx };
  }, [rx, tx]);
  return rate;
}

function LoadTiles() {
  const { server, stats, state } = useServerStore(
    useShallow((s) => ({ server: s.server, stats: s.stats, state: s.state })),
  );
  const series = useResourceSeries(server.uuid);
  useEffect(() => pushLive(server.uuid, stats), [server.uuid, stats]);

  const off = state === 'offline' && server.status !== 'installing';
  const cpu = useTween(off ? 0 : (stats?.cpuAbsolute ?? 0));
  const mem = useTween(off ? 0 : (stats?.memoryBytes ?? 0));
  const disk = useTween(stats?.diskBytes ?? 0);
  const rate = useNetworkRate(stats?.network.rxBytes, stats?.network.txBytes);
  const rx = useTween(off ? 0 : rate.rx);
  const tx = useTween(off ? 0 : rate.tx);

  const cpuLimit = server.limits.cpu;
  const memLimit = server.limits.memory ? server.limits.memory * 1024 * 1024 : 0;
  const diskLimit = server.limits.disk ? server.limits.disk * 1024 * 1024 : 0;
  const cpuSeries = useMemo(() => series.map((sample) => sample.cpu), [series]);
  const memSeries = useMemo(() => series.map((sample) => sample.mem), [series]);
  const netSeries = useMemo(() => series.map((sample) => sample.net), [series]);
  const sparkTimes = useMemo(() => series.map((sample) => sample.t), [series]);
  const waiting = !stats;
  const resources = `/server/${server.uuidShort}/console/history`;
  const { t } = useExtTranslations();

  return (
    <section className='taxz-kpis' aria-label={t('consolePage.load', {})}>
      <h2 className='taxz-sr'>{t('consolePage.load', {})}</h2>
      <Tile
        icon={faMicrochip}
        to={resources}
        label='CPU'
        value={waiting || off ? '–' : `${num(cpu, cpu < 10 ? 1 : 0)} %`}
        max={cpuLimit ? `${cpuLimit} %` : undefined}
        pct={waiting || off ? null : cpuLimit ? (cpu / cpuLimit) * 100 : null}
        spark={cpuSeries}
        sparkTimes={sparkTimes}
        sparkMax={cpuLimit || undefined}
      />
      <Tile
        icon={faMemory}
        to={resources}
        label='RAM'
        value={waiting || off ? '–' : bytes(mem)}
        max={memLimit ? bytes(memLimit) : undefined}
        pct={waiting || off ? null : memLimit ? (mem / memLimit) * 100 : null}
        spark={memSeries}
        sparkTimes={sparkTimes}
        sparkMax={memLimit || undefined}
      />
      <Tile
        icon={faHardDrive}
        to={resources}
        label={t('metric.disk', {})}
        value={waiting ? '–' : bytes(disk)}
        max={diskLimit ? bytes(diskLimit) : undefined}
        pct={waiting ? null : diskLimit ? (disk / diskLimit) * 100 : null}
      />
      <Tile
        icon={faArrowRightArrowLeft}
        to={resources}
        label={t('metric.network', {})}
        value={waiting || off ? '–' : `${bytes(rx + tx)}/s`}
        detail={waiting || off ? undefined : `↓ ${bytes(rx)}/s · ↑ ${bytes(tx)}/s`}
        spark={netSeries}
        sparkTimes={sparkTimes}
      />
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.server.console.statCards}
        name='console-stat-card'
      />
    </section>
  );
}

function TaxzServerConsole() {
  const server = useServerStore((state) => state.server);
  const keyboardInset = useVisualViewportBottomInset();
  const { t } = useExtTranslations();
  useNavbarPageHeader({ title: server.name, subtitle: t('nav.tab.console', {}) });

  return (
    <ServerContentContainer
      title={t('nav.tab.console', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.console.container}
    >
      <LoadTiles />
      <div
        className='taxz-console'
        style={
          keyboardInset > 0 ? { height: `max(8rem, min(60vh, calc(100dvh - ${keyboardInset}px - 7rem)))` } : undefined
        }
      >
        <Console />
      </div>
    </ServerContentContainer>
  );
}

export default function ServerConsole() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzServerConsole /> : <OriginalServerConsole />;
}
