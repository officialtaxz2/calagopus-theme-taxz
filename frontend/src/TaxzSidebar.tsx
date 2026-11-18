// Seitenleiste im taxz-Theme: dieselben Eintraege wie im Standard-Panel, nur in Gruppen sortiert (Designvorgabe 6.1),
// dazu am Handy eine schwebende Tab-Leiste mit "Mehr" (6.3). Mit "Standard" wird nichts davon gerendert.
// Hat der Admin eine eigene Reihenfolge mit Trennern angelegt, bleibt dessen Reihenfolge erhalten.
// Konto: vier Punkte wie in 6.1 (Konto, Darstellung, "Schluessel und Sitzungen" zum Aufklappen, Befehlskuerzel), dazu
// Tastaturkuerzel, das das Panel zusaetzlich hat. Im Server: oben "Alle Server" und die Server-Karte als Umschalter
// (Symbol, Name, Status, Laufzeit); Start/Stopp darin nur, wenn kein Server-Kopf zu sehen ist. Admin-Links unter "Verwaltung".
// Der Ressourcenverlauf des Panels (/console/history) bekommt unter "Konsole" einen eigenen Punkt "Ressourcen".

import {
  faArrowLeft,
  faBars,
  faChartLine,
  faChevronRight,
  faFolder,
  faGauge,
  faGear,
  faKey,
  faMagnifyingGlass,
  faMoon,
  faServer,
  faSun,
  faTerminal,
  faUser,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classNames from 'classnames';
import {
  Children,
  cloneElement,
  type CSSProperties,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { Link, matchPath, NavLink, useLocation } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { ServerCan } from '@/elements/Can.tsx';
import Drawer from '@/elements/overlays/Drawer.tsx';
import ServerSwitcher from '@/elements/navigation/ServerSwitcher.tsx';
import Sidebar from '@/elements/navigation/Sidebar.tsx';
import ServerStatusIndicator from '@/elements/ServerStatusIndicator.tsx';
import ServerPowerControls from '@/pages/server/console/stats/ServerPowerControls.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useQuickActionsStore } from '@/stores/quickActions.ts';
import { useRelativePageStore } from '@/stores/relativePage.ts';
import { useServerStore } from '@/stores/server.ts';
import { type CrumbPage, setCrumbPage } from './Breadcrumbs.tsx';
import { gameLook } from './games.ts';
import { useIsTaxz } from './prefs.ts';
import NotificationBell from './NotificationBell.tsx';
import { ServerEmblem } from './ServerArt.tsx';
import { useCurrentServerStatus } from './CrashHelp.tsx';
import { useServerHeadVisible } from './ServerHead.tsx';
import { useServerImage } from './serverImages.ts';
import { isActive, uptime } from './serverStatus.ts';
import { getExtTranslations, useExtTranslations } from './translations.ts';
import WelcomeLook from './WelcomeLook.tsx';

type SidebarProps = { children: ReactNode; header?: ReactNode; footer?: ReactNode };
type Entry = { kind: 'link'; to: string; node: ReactElement } | { kind: 'divider'; label?: string } | { kind: 'other'; node: ReactNode };

type Context = { kind: 'dashboard' } | { kind: 'server'; base: string } | { kind: 'admin' };

function linkTarget(node: ReactElement): string | null {
  const props = node.props as { to?: unknown; children?: ReactNode };
  if (node.type === Sidebar.Link && typeof props.to === 'string') return props.to;
  // ServerCan und aehnliche Huellen: Ziel aus dem einzigen Link darin
  const inner = Children.toArray(props.children).find(isValidElement) as ReactElement | undefined;
  if (inner && inner.type === Sidebar.Link) {
    const innerProps = inner.props as { to?: unknown };
    return typeof innerProps.to === 'string' ? innerProps.to : null;
  }
  return null;
}

function flatten(nodes: ReactNode, out: Entry[] = []): Entry[] {
  Children.forEach(nodes, (node) => {
    if (!isValidElement(node)) return;
    if (node.type === Fragment) {
      flatten((node.props as { children?: ReactNode }).children, out);
      return;
    }
    if (node.type === Sidebar.Divider) {
      out.push({ kind: 'divider', label: (node.props as { label?: string }).label });
      return;
    }
    const to = linkTarget(node);
    if (to !== null) out.push({ kind: 'link', to, node });
    else out.push({ kind: 'other', node });
  });
  return out;
}

const strip = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

// Ressourcenverlauf des Panels: eigener Navigationspunkt direkt unter "Konsole". Das Panel zaehlt die Seite zur Konsole
// (activeMatches), daher wird dieses Muster aus dem Konsolen-Link genommen, sonst waeren dort beide Punkte aktiv.
const RESOURCES_PATH = '/console/history';

function withResources(nodes: ReactNode, base: string, state: { done: boolean }): ReactNode {
  return Children.map(nodes, (node) => {
    if (state.done || !isValidElement(node)) return node;
    if (node.type === Fragment) {
      const children = (node.props as { children?: ReactNode }).children;
      return cloneElement(node, undefined, withResources(children, base, state));
    }
    if (node.type !== Sidebar.Link || strip((node.props as { to?: string }).to ?? '') !== base) return node;
    state.done = true;
    const matches = (node.props as { activeMatches?: string[] }).activeMatches;
    const consoleLink = cloneElement(node as ReactElement<{ activeMatches?: string[] }>, {
      activeMatches: matches?.filter((pattern) => !pattern.endsWith(RESOURCES_PATH)),
    });
    return [
      consoleLink,
      <Sidebar.Link
        key='taxz-resources'
        to={`${base}${RESOURCES_PATH}`}
        icon={faChartLine}
        name={getExtTranslations().t('nav.resources', {})}
      />,
    ];
  });
}

/** Fuegt im Server den Punkt "Ressourcen" hinter "Konsole" ein (nur wenn der Konsolen-Link da ist). */
function addResources(props: SidebarProps, context: Context): SidebarProps {
  if (context.kind !== 'server') return props;
  const state = { done: false };
  const children = withResources(props.children, context.base, state);
  return state.done ? { ...props, children } : props;
}

// Gruppen der Navigation; der Schluessel ist zugleich der Uebersetzungsschluessel nav.group.<schluessel>, '' ist ohne Titel.
export type NavGroup = '' | 'overview' | 'account' | 'admin' | 'more' | 'control' | 'setup' | 'share';

export function groupLabel(group: NavGroup): string {
  return group ? getExtTranslations().t(`nav.group.${group}`, {}) : '';
}

function dashboardGroup(to: string): NavGroup {
  const path = strip(to);
  if (path === '/' || path === '/account/activity') return 'overview';
  if (path === '/admin') return 'admin';
  if (
    [
      '/account',
      '/account/appearance',
      '/account/security-keys',
      '/account/api-keys',
      '/account/ssh-keys',
      '/account/oauth-links',
      '/account/sessions',
      '/account/command-snippets',
      '/account/shortcuts',
    ].includes(path)
  )
    return 'account';
  return 'more';
}

// Konto-Gruppe (6.1): Reihenfolge, und welche Punkte unter "Schluessel und Sitzungen" zusammengefasst werden.
const KEY_PATHS = ['/account/security-keys', '/account/api-keys', '/account/ssh-keys', '/account/oauth-links', '/account/sessions'];
const ACCOUNT_ORDER = ['/account', '/account/appearance', 'keys', '/account/command-snippets', '/account/shortcuts'];

function serverGroup(to: string, base: string): NavGroup {
  const path = strip(to);
  if (!path.startsWith(base)) return path === '/admin' || path.startsWith('/admin/') ? 'admin' : '';
  const rest = path.slice(base.length) || '/';
  if (['/', RESOURCES_PATH, '/files', '/backups', '/schedules'].includes(rest)) return 'control';
  if (['/network', '/databases', '/startup', '/mounts', '/settings'].includes(rest)) return 'setup';
  if (['/subusers', '/activity'].includes(rest)) return 'share';
  return 'more';
}

// Eigene Namen fuer Punkte, deren Panel-Name im Theme nicht passt (Designvorgabe 1.6), z. B. "Alle Server" im Server.
function ownName(kind: 'dashboard' | 'server', to: string): string | undefined {
  const { t } = getExtTranslations();
  const path = strip(to);
  if (kind === 'dashboard') {
    if (path === '/') return t('nav.servers', {});
    if (path === '/account') return t('nav.account', {});
    return undefined;
  }
  return path === '/' ? t('nav.allServers', {}) : undefined;
}

function withOwnName(node: ReactElement, to: string, key: string, kind: 'dashboard' | 'server'): ReactElement {
  const name = ownName(kind, to);
  return node.type === Sidebar.Link && name ? cloneElement(node as ReactElement<{ name?: string }>, { key, name }) : cloneElement(node, { key });
}

function linkName(node: ReactElement): string | null {
  const props = node.props as { name?: unknown; children?: ReactNode };
  if (node.type === Sidebar.Link) return typeof props.name === 'string' ? props.name : null;
  const inner = Children.toArray(props.children).find(isValidElement) as ReactElement | undefined;
  if (inner && inner.type === Sidebar.Link) {
    const name = (inner.props as { name?: unknown }).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

/** Aktiver Navigationspunkt fuer die Brotkrumen: der laengste Link, der zum Pfad passt. */
function activePage(props: SidebarProps, context: Context, pathname: string): CrumbPage {
  const path = strip(pathname);
  const kind = context.kind === 'server' ? 'server' : 'dashboard';
  let best: NonNullable<CrumbPage> | null = null;
  for (const entry of [...flatten(props.header), ...flatten(props.children)]) {
    if (entry.kind !== 'link') continue;
    const to = strip(entry.to);
    const matches = path === to || (to !== '/' && path.startsWith(`${to}/`));
    if (!matches || (best && best.to.length >= to.length)) continue;
    const label = ownName(kind, to) ?? linkName(entry.node);
    if (!label) continue;
    const group =
      context.kind === 'server' ? serverGroup(to, context.base) : context.kind === 'admin' ? '' : dashboardGroup(to);
    best = { label, to, group };
  }
  return best;
}

const ORDER: Record<Context['kind'], NavGroup[]> = {
  dashboard: ['overview', 'account', 'admin', 'more'],
  server: ['', 'control', 'setup', 'share', 'admin', 'more'],
  admin: [],
};

function useSidebarContext(): Context {
  const { pathname } = useLocation();
  const server = pathname.match(/^\/server\/[^/]+/);
  if (server) return { kind: 'server', base: server[0] };
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return { kind: 'admin' };
  return { kind: 'dashboard' };
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className='taxz-ngrp' role='group' aria-label={title || undefined}>
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}

/** Aufklappbarer Punkt in der Navigation; offen, solange einer seiner Unterpunkte aktiv ist. */
function Fold({ label, icon, paths, children }: { label: string; icon: IconDefinition; paths: string[]; children: ReactNode }) {
  const { pathname } = useLocation();
  const path = strip(pathname);
  const active = paths.some((to) => path === to || path.startsWith(`${to}/`));
  const [open, setOpen] = useState(active);
  const id = useId();

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className={classNames('taxz-fold', open && 'is-open', active && 'has-active')}>
      <button type='button' className='taxz-fold-btn' aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <FontAwesomeIcon icon={icon} aria-hidden='true' />
        <span>{label}</span>
        <FontAwesomeIcon icon={faChevronRight} className='taxz-fold-chev' aria-hidden='true' />
      </button>
      <div id={id} className='taxz-fold-body' hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/** Server-Umschalter oben in der Seitenleiste (6.1): Symbol, Name als Auswahlfeld des Panels, Status und Laufzeit. */
function ServerCard({ switcher }: { switcher: ReactElement | null }) {
  const { server, state, stats } = useServerStore(
    useShallow((s) => ({ server: s.server, state: s.state, stats: s.stats })),
  );
  const look = useMemo(() => gameLook(server?.egg), [server?.egg]);
  const image = useServerImage(server?.uuid ?? '');
  const headVisible = useServerHeadVisible();
  const { status, crash, disconnected } = useCurrentServerStatus(server, state);
  const { t } = useExtTranslations();
  if (!server?.uuid) return null;

  const line =
    isActive(state) && !disconnected && !crash && stats?.uptime ? `${status.label} · ${uptime(stats.uptime)}` : status.label;

  return (
    <div className='taxz-swcard'>
      <div className='taxz-swcard-row'>
        <ServerEmblem look={look} size='sm' image={image} />
        <div className='taxz-swcard-main'>
          {switcher ? (
            <label className='taxz-swcard-pick'>
              <span className='taxz-sr'>{t('nav.switchServer', {})}</span>
              {switcher}
            </label>
          ) : (
            <b className='taxz-swcard-name'>{server.name}</b>
          )}
          <span className={classNames('taxz-swcard-status', `taxz-tone-${status.tone}`)}>
            <span className='taxz-dot' aria-hidden='true' />
            {line}
          </span>
        </div>
      </div>
      {!headVisible && (
        <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
          <div className='taxz-swcard-power'>
            <ServerPowerControls />
          </div>
        </ServerCan>
      )}
    </div>
  );
}

type Placed = { to: string; node: ReactElement };

function accountItems(list: Placed[]): ReactNode[] {
  const keys = list.filter((item) => KEY_PATHS.includes(strip(item.to)));
  const rank = (to: string) => {
    const index = ACCOUNT_ORDER.indexOf(KEY_PATHS.includes(to) ? 'keys' : to);
    return index === -1 ? ACCOUNT_ORDER.length : index;
  };
  const rest = list.filter((item) => keys.length < 2 || !KEY_PATHS.includes(strip(item.to)));
  const entries: { rank: number; node: ReactNode }[] = rest.map((item) => ({ rank: rank(strip(item.to)), node: item.node }));
  if (keys.length >= 2) {
    entries.push({
      rank: rank('keys'),
      node: (
        <Fold key='keys' label={getExtTranslations().t('nav.keys', {})} icon={faKey} paths={keys.map((item) => strip(item.to))}>
          {keys.map((item) => item.node)}
        </Fold>
      ),
    });
  }
  // stabile Sortierung: Punkte ohne festen Platz behalten ihre Reihenfolge am Ende
  return entries.sort((x, y) => x.rank - y.rank).map((entry) => entry.node);
}

const SERVER_LIST_PATHS = ['/', '/grouped', '/all'];

function regroup(props: SidebarProps, context: Context, pathname: string): SidebarProps | null {
  if (context.kind === 'admin') return null;

  const headerEntries = flatten(props.header);
  const bodyEntries = flatten(props.children);
  // Eigene Reihenfolge des Admins (Trenner mit Namen): nicht umsortieren.
  if (bodyEntries.some((entry) => entry.kind === 'divider' && entry.label)) return null;

  // Server-Umschalter des Panels aus dem Fuss holen, er kommt nach oben (6.1).
  let switcher: ReactElement | null = null;
  const footer: ReactNode[] = [];
  for (const [index, entry] of flatten(props.footer).entries()) {
    if (entry.kind === 'other' && isValidElement(entry.node) && entry.node.type === ServerSwitcher) switcher = entry.node;
    else if (entry.kind !== 'divider') footer.push(cloneElement(entry.node as ReactElement, { key: `f-${index}` }));
  }

  const groups = new Map<NavGroup, Placed[]>();
  const keep: ReactNode[] = [];

  const place = (entry: Entry, index: number, fromHeader: boolean) => {
    if (entry.kind === 'link') {
      const group = context.kind === 'server' ? serverGroup(entry.to, context.base) : dashboardGroup(entry.to);
      const list = groups.get(group) ?? [];
      const key = `${group}-${entry.to}-${index}`;
      list.push({ to: entry.to, node: withOwnName(entry.node, entry.to, key, context.kind) });
      groups.set(group, list);
    } else if (entry.kind === 'other' && fromHeader) {
      // Die Status-Karte des Panels ersetzt im Server die eigene Server-Karte.
      if (context.kind === 'server' && isValidElement(entry.node) && entry.node.type === ServerStatusIndicator) return;
      keep.push(cloneElement(entry.node as ReactElement, { key: `h-${index}` }));
    }
  };

  headerEntries.forEach((entry, index) => place(entry, index, true));
  bodyEntries.forEach((entry, index) => place(entry, index + 1000, false));

  const order = ORDER[context.kind];
  const known = [...order, ...[...groups.keys()].filter((key) => !order.includes(key))];
  const items = (key: NavGroup): ReactNode[] => {
    const list = groups.get(key) ?? [];
    return context.kind === 'dashboard' && key === 'account' ? accountItems(list) : list.map((item) => item.node);
  };
  const { t } = getExtTranslations();

  // Auf der Serverliste selbst waere der Umschalter doppelt (die Liste hat ihre eigene Suche).
  const jump =
    context.kind === 'dashboard' && switcher && !SERVER_LIST_PATHS.includes(strip(pathname)) ? (
      <label key='jump' className='taxz-jump'>
        <span className='taxz-jump-label'>{t('nav.jumpToServer', {})}</span>
        {switcher}
      </label>
    ) : null;

  return {
    ...props,
    header: (
      <div className='taxz-side-head'>
        {keep}
        {jump}
      </div>
    ),
    footer: footer.length > 0 ? <>{footer}</> : undefined,
    children: (
      <nav className='taxz-nav' aria-label={t('nav.label', {})}>
        {known
          .filter((key) => groups.has(key))
          .map((key) => (
            <Fragment key={key || 'top'}>
              <Group title={groupLabel(key)}>{items(key)}</Group>
              {key === '' && context.kind === 'server' && <ServerCard switcher={switcher} />}
            </Fragment>
          ))}
      </nav>
    ),
  };
}

type Tab = { to: string; label: string; icon: IconDefinition; end?: boolean };

function tabsFor(context: Context): Tab[] {
  const { t } = getExtTranslations();
  if (context.kind === 'server') {
    return [
      { to: context.base, label: t('nav.tab.console', {}), icon: faTerminal, end: true },
      { to: `${context.base}/files`, label: t('nav.tab.files', {}), icon: faFolder },
      // Weiches Trennzeichen in der Uebersetzung: Mit grosser Schrift bricht das Wort am Handy sauber in zwei Zeilen statt
      // abgeschnitten zu werden.
      { to: `${context.base}/settings`, label: t('nav.tab.settings', {}), icon: faGear },
    ];
  }
  if (context.kind === 'admin') {
    return [
      { to: '/admin', label: t('nav.tab.overview', {}), icon: faGauge, end: true },
      { to: '/admin/servers', label: t('nav.tab.servers', {}), icon: faServer },
      { to: '/admin/users', label: t('nav.tab.users', {}), icon: faUsers },
    ];
  }
  return [
    { to: '/', label: t('nav.tab.servers', {}), icon: faServer, end: true },
    { to: '/account/activity', label: t('nav.tab.activity', {}), icon: faChartLine },
    { to: '/account', label: t('nav.tab.account', {}), icon: faUser, end: true },
  ];
}

function MobileBars({ props }: { props: SidebarProps }) {
  const context = useSidebarContext();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const pageHeader = useRelativePageStore((state) => state.pageHeader);
  const openQuickActions = useQuickActionsStore((state) => state.setOpen);
  const appName = useGlobalStore((state) => state.settings.app.name);
  const { t } = useExtTranslations();

  useEffect(() => setOpen(false), [pathname]);

  const tabs = tabsFor(context);
  // Liegt die Seite nicht hinter einem der drei Tabs (z. B. Ressourcen, Backups), ist "Mehr" markiert, damit man sieht, wo man ist.
  const onServerList = context.kind === 'dashboard' && SERVER_LIST_PATHS.includes(strip(pathname));
  const inMore =
    !onServerList &&
    !tabs.some((tab) => matchPath({ path: tab.to, end: tab.end ?? false }, pathname));

  return (
    <>
      <header className='taxz-ph-top'>
        {context.kind === 'server' && strip(pathname) === `${context.base}${RESOURCES_PATH}` ? (
          <Link to={context.base} className='taxz-ph-btn' aria-label={t('nav.backToConsole', {})} title={t('nav.tab.console', {})}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </Link>
        ) : (
          context.kind !== 'dashboard' && (
            <Link to='/' className='taxz-ph-btn' aria-label={t('nav.backToServers', {})} title={t('nav.allServers', {})}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Link>
          )
        )}
        <div className='taxz-ph-title'>
          {pageHeader ? (
            <>
              <b>{pageHeader.title}</b>
              {pageHeader.subtitle && <small>{pageHeader.subtitle}</small>}
            </>
          ) : (
            <b>{appName}</b>
          )}
        </div>
        <NotificationBell placement='mobile' />
        <button
          type='button'
          className='taxz-ph-btn'
          onClick={() => openQuickActions(true)}
          aria-label={t('nav.openSearch', {})}
          title={t('nav.search', {})}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
      </header>

      <nav className='taxz-ph-tabs' aria-label={t('nav.quickNav', {})}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            // Die Serverliste hat drei Ansichten (/, /grouped, /all); der Tab "Server" gilt fuer alle.
            className={({ isActive }) => classNames('taxz-tab', (isActive || (onServerList && tab.to === '/')) && 'is-on')}
          >
            <FontAwesomeIcon icon={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          type='button'
          className={classNames('taxz-tab', (open || inMore) && 'is-on')}
          onClick={() => setOpen(true)}
          aria-haspopup='dialog'
        >
          <FontAwesomeIcon icon={faBars} />
          <span>{t('nav.more', {})}</span>
        </button>
      </nav>

      <Drawer
        opened={open}
        onClose={() => setOpen(false)}
        position='bottom'
        size='85%'
        title={t('nav.more', {})}
        classNames={{ content: 'taxz-ph-sheet' }}
      >
        <div className='taxz-ph-sheet-body'>
          {props.header}
          {props.children}
          {props.footer}
        </div>
      </Drawer>
    </>
  );
}

function TaxzSidebarSwitch({ element, props: panelProps }: { element: ReactElement<SidebarProps>; props: SidebarProps }) {
  const isTaxz = useIsTaxz();
  const context = useSidebarContext();
  const props = isTaxz ? addResources(panelProps, context) : panelProps;
  const wide = useMediaQuery('(min-width: 641px)', window.matchMedia('(min-width: 641px)').matches);
  const setHasMobileNavbar = useRelativePageStore((state) => state.setHasMobileNavbar);
  const { pathname } = useLocation();
  const page = isTaxz ? activePage(props, context, pathname) : null;

  useEffect(() => {
    setCrumbPage(page);
  });

  // Das Standard-Panel zeigt die Seitenleiste erst ab 1024 px und haengt den Seitentitel darunter in seine Handy-Kopfzeile.
  // Im taxz-Theme bleibt die Seitenleiste ab 641 px (Designvorgabe 6.2), also gehoert der Titel dort zurueck auf die Seite.
  // Laeuft nach dem Effekt der Seitenleiste (Kind vor Eltern); beim Abbau setzt die Seitenleiste selbst zurueck.
  useEffect(() => {
    setHasMobileNavbar(!(isTaxz && wide));
  }, [isTaxz, wide]);

  if (!isTaxz) return element;

  const grouped = regroup(props, context, pathname) ?? props;
  // Glocke oben rechts in der Seitenleiste (neben dem Logo); im Handy-Blatt "Mehr" sitzt sie im Kopf statt im Kopfbereich.
  const withBell: SidebarProps = {
    ...grouped,
    header: (
      <>
        <div className='taxz-sb-bell'>
          <NotificationBell placement='sidebar' />
        </div>
        {grouped.header}
      </>
    ),
  };
  return (
    <>
      {cloneElement(element, withBell)}
      <MobileBars props={grouped} />
      <WelcomeLook />
    </>
  );
}

function ModeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('dark');
  const next = computed === 'dark' ? 'light' : 'dark';
  const { t } = useExtTranslations();
  return (
    <button
      type='button'
      className='taxz-mode-toggle'
      onClick={() => setColorScheme(next)}
      aria-label={next === 'light' ? t('nav.toLight', {}) : t('nav.toDark', {})}
      title={next === 'light' ? t('appearance.scheme.light', {}) : t('appearance.scheme.dark', {})}
    >
      <FontAwesomeIcon icon={computed === 'dark' ? faSun : faMoon} />
    </button>
  );
}

/** Rolle unter dem Namen (6.1): Name der Rolle, sonst Administrator oder Benutzer. */
function roleLabel(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) return '';
  const role = user.role?.name?.trim();
  if (role) return role;
  return user.admin ? getExtTranslations().t('nav.roleAdmin', {}) : getExtTranslations().t('nav.roleUser', {});
}

// Als CSS-Zeichenkette fuer "content: var(--taxz-role)"; Steuerzeichen raus, Anfuehrungszeichen und Backslash maskiert.
function cssString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) out += ' ';
    else if (char === '"' || char === '\\') out += `\\${char}`;
    else out += char;
  }
  return `"${out}"`;
}

function TaxzFooterSwitch({ element }: { element: ReactElement }) {
  const isTaxz = useIsTaxz();
  const { user } = useAuth();
  if (!isTaxz) return element;
  return (
    <div className='taxz-foot' style={{ '--taxz-role': cssString(roleLabel(user)) } as CSSProperties}>
      {element}
      <ModeToggle />
    </div>
  );
}

export function registerSidebarHooks() {
  Sidebar.addRenderInterceptor((element, props) => <TaxzSidebarSwitch element={element} props={props as SidebarProps} />);
  Sidebar.Footer.addRenderInterceptor((element) => <TaxzFooterSwitch element={element} />);
}
