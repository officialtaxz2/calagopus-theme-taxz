// Ruhiger Server-Kopf auf allen Unterseiten eines Servers (Designvorgabe 7.2): Symbol 56 px, Name 26 px,
// Unterzeile mit Status-Pill (plus Laufzeit), Adresse, Egg; rechts die Ein/Aus-Knoepfe des Panels.
// Haengt als Render-Interceptor an ServerContentContainer; mit "Standard", im Vollbild und im Konsolen-Popout bleibt alles wie im Original.

import type { HookableComponent } from 'shared';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type ComponentProps, type ReactElement, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { formatAllocation } from '@/lib/domain/server.ts';
import ServerPowerControls from '@/pages/server/console/stats/ServerPowerControls.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { CrashCard, useCurrentServerStatus } from './CrashHelp.tsx';
import { gameLook } from './games.ts';
import { useIsTaxz } from './prefs.ts';
import { ServerEmblem } from './ServerArt.tsx';
import { useServerImage } from './serverImages.ts';
import { uptime } from './serverStatus.ts';
import StartProgress from './StartProgress.tsx';
import TabStatus from './TabStatus.tsx';
import { StatusPill } from './TaxzServerItem.tsx';
import { useExtTranslations } from './translations.ts';

type ContainerProps = ComponentProps<typeof ServerContentContainer>;

// Ob gerade ein Server-Kopf (mit Ein/Aus-Knoepfen) zu sehen ist. Die Server-Karte in der Seitenleiste zeigt die Knoepfe
// nur, wenn kein Kopf da ist, damit Start/Stopp nicht doppelt erscheint, aber auch nie ganz fehlt.
let headCount = 0;
const headListeners = new Set<() => void>();
const subscribeHead = (listener: () => void) => {
  headListeners.add(listener);
  return () => headListeners.delete(listener);
};
const changeHeadCount = (delta: number) => {
  headCount += delta;
  headListeners.forEach((listener) => listener());
};

export function useServerHeadVisible(): boolean {
  return useSyncExternalStore(subscribeHead, () => headCount > 0);
}

export function ServerHead() {
  const { server, state, stats } = useServerStore(
    useShallow((s) => ({ server: s.server, state: s.state, stats: s.stats })),
  );
  const look = useMemo(() => gameLook(server.egg), [server.egg]);
  const image = useServerImage(server.uuid);
  const { pathname } = useLocation();
  const { t } = useExtTranslations();
  const canStart = useServerCan('control.start');
  const { status, crash, disconnected } = useCurrentServerStatus(server, state);
  const onConsole = /^\/server\/[^/]+\/?$/.test(pathname);
  const running = state === 'running' || state === 'starting' || state === 'stopping';
  const address = server.allocation ? formatAllocation(server.allocation, server.egg.separatePort) : null;
  const pill =
    running && !disconnected && !crash && stats?.uptime ? `${status.label} · ${uptime(stats.uptime)}` : status.label;

  useEffect(() => {
    changeHeadCount(1);
    return () => changeHeadCount(-1);
  }, []);

  return (
    <>
      <section className='taxz-shead' aria-label={t('serverHead.label', { name: server.name })}>
        <ServerEmblem look={look} size='lg' image={image} />
        <div className='taxz-shead-main'>
          <h1 className='taxz-shead-name'>{server.name}</h1>
          <div className='taxz-shead-sub'>
            <StatusPill tone={status.tone} label={pill} />
            {address && (
              <span className='taxz-addr'>
                <span className='taxz-mono'>
                  <RedactedText value={address} />
                </span>
                <CopyOnClick content={address} className='taxz-ib'>
                  <span className='taxz-sr'>{t('serverHead.copyAddress', {})}</span>
                  <FontAwesomeIcon icon={faCopy} aria-hidden='true' />
                </CopyOnClick>
              </span>
            )}
            <span className='taxz-shead-egg'>{server.egg.name}</span>
          </div>
          {server.description && <p className='taxz-shead-desc'>{server.description}</p>}
          <StartProgress />
        </div>
        <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
          <div className='taxz-shead-power'>
            <ServerPowerControls />
          </div>
        </ServerCan>
      </section>
      {crash && onConsole && <CrashCard server={server} crash={crash} canStart={canStart} />}
    </>
  );
}

function ServerFrame({ element, props }: { element: ReactElement; props: ContainerProps }) {
  const isTaxz = useIsTaxz();
  const { id } = useCurrentWindow();
  // Laesst sich der Server nicht laden (geloescht, kein Zugriff, Fehler, Anfragelimit), ist der Store leer. Dann bleibt die
  // Seite des Panels ("Nicht gefunden" usw.) unveraendert, statt dass Kopf und Tab-Status auf fehlende Felder zugreifen.
  const loaded = useServerStore((s) => !!s.server?.uuid && !!s.server?.egg);
  if (!isTaxz || id || !loaded) return element;
  if (props.fullscreen)
    return (
      <>
        <TabStatus />
        {element}
      </>
    );
  return (
    <>
      <TabStatus />
      <div className='taxz-shead-wrap'>
        <ServerHead />
      </div>
      {element}
    </>
  );
}

export function registerServerHead() {
  // Der Default-Export ist im Panel auf den einfachen Komponententyp gecastet, die Hook-Methoden gibt es trotzdem.
  (ServerContentContainer as unknown as HookableComponent<ContainerProps>).addRenderInterceptor((element, props) => (
    <ServerFrame element={element} props={props} />
  ));
}
