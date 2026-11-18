// Brotkrumen-Zeile (Designvorgabe 6.1): oben im Inhalt eine schmale Zeile (44 px, ohne Linie), z. B.
// "Server › Left 4 Dead 2 › Backups", "Konto › Darstellung" oder "Admin › Nodes". Der Name der aktuellen Seite kommt aus
// dem aktiven Eintrag der Seitenleiste (dieselben Namen wie in der Navigation, auch fuer Seiten von Erweiterungen).
// Nur breit (ab 641 px); am Handy steht der Titel in der Kopfleiste. Mit "Standard" wird nichts gerendert.

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Fragment, type ReactNode, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router';
import Container from '@/elements/layout/Container.tsx';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';

export type CrumbPage = { label: string; to: string; group: string } | null;

let current: CrumbPage = null;
const listeners = new Set<() => void>();

/** Von der Seitenleiste gesetzt: Name, Ziel und Gruppe des aktiven Navigationspunkts. */
export function setCrumbPage(page: CrumbPage) {
  if (page?.label === current?.label && page?.to === current?.to && page?.group === current?.group) return;
  current = page;
  listeners.forEach((listener) => listener());
}

function useCrumbPage(): CrumbPage {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
  );
}

type Crumb = { label: string; to?: string };

function Trail({ items }: { items: Crumb[] }) {
  return (
    <nav className='taxz-crumbs' aria-label='Brotkrumen'>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              {index > 0 && (
                <li className='taxz-crumb-sep' aria-hidden='true'>
                  <FontAwesomeIcon icon={faChevronRight} />
                </li>
              )}
              <li>
                {last || !item.to ? (
                  <span aria-current={last ? 'page' : undefined}>{item.label}</span>
                ) : (
                  <Link to={item.to}>{item.label}</Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function ServerTrail({ base, page }: { base: string; page: CrumbPage }) {
  const name = useServerStore((state) => state.server?.name);
  const items: Crumb[] = [{ label: 'Server', to: '/' }];
  if (name) items.push({ label: name, to: base });
  if (page && page.to !== '/') items.push({ label: page.label });
  return <Trail items={items} />;
}

const strip = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

function Crumbs() {
  const isTaxz = useIsTaxz();
  const { id } = useCurrentWindow();
  const { pathname } = useLocation();
  const page = useCrumbPage();
  if (!isTaxz || id) return null;

  const path = strip(pathname);
  const server = path.match(/^\/server\/[^/]+/);
  if (server) return <ServerTrail base={server[0]} page={page} />;

  if (path === '/admin' || path.startsWith('/admin/')) {
    const items: Crumb[] = [{ label: 'Admin', to: '/admin' }];
    items.push({ label: page && page.to !== '/admin' ? page.label : 'Übersicht' });
    return <Trail items={items} />;
  }

  if (path === '/account' || path.startsWith('/account/')) {
    if (page?.group === 'Konto' && page.to !== '/account') {
      return <Trail items={[{ label: 'Konto', to: '/account' }, { label: page.label }]} />;
    }
    return <Trail items={[{ label: page?.label ?? 'Konto' }]} />;
  }

  return <Trail items={[{ label: page?.label ?? 'Server' }]} />;
}

export function registerBreadcrumbs() {
  // Immer dieselbe Huelle, damit der Baum beim Umschalten des Themes gleich bleibt; mit "Standard" rendert Crumbs nichts.
  Container.addPropsInterceptor((props) => ({
    ...props,
    children: (
      <>
        <Crumbs />
        {props.children as ReactNode}
      </>
    ),
  }));
}
