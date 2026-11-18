// Konsole mit Filter und Schnellbefehlen (Designvorgabe 9.6, Idee 8).
// - ConsoleFilter haengt in der Kopfzeile der Konsole: Segment "Alle / Warnungen / Fehler" (Schluesselwoerter, consoleLevel.ts)
//   und Textsuche. Ist ein Filter aktiv, legt sich eine gefilterte Liste ueber die Ausgabe; die Konsole selbst laeuft darunter weiter.
// - QuickCommands haengt in der Eingabezeile: die Befehlskuerzel des Benutzers, die das Panel fuer dieses Egg schon kennt.
//   Ein Klick fuellt nur die Eingabezeile, geschickt wird wie immer mit Enter. Keine fest eingebauten Befehle.
// Beides nur im taxz-Theme; mit "Standard" rendern beide Bausteine nichts.

import type { ExtensionContext } from 'shared';
import { faFilter, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router';
import { ServerCan } from '@/elements/Can.tsx';
import { redactConsoleLine } from '@/lib/network/redact.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import {
  CONSOLE_FONT_SIZE_DEFAULT,
  CONSOLE_FONT_SIZE_KEY,
  consoleFontSizeSchema,
} from '@/pages/server/console/terminal/TerminalHeader.tsx';
import { useRedactAddresses } from '@/plugins/privacy/useRedactAddresses.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { useServerStore } from '@/stores/server.ts';
import { type LineLevel, lineLevel } from './consoleLevel.ts';
import { useIsTaxz } from './prefs.ts';
import { cleanLine } from './StartProgress.tsx';
import { useExtTranslations } from './translations.ts';

const MAX_LINES = 3000;

type Level = 'all' | 'warn' | 'error';
interface Line {
  id: number;
  text: string;
  level: LineLevel;
}

/** Sammelt die Ausgabe mit; beim (Wieder-)Verbinden schickt das Panel den Verlauf neu, daher dann von vorn. */
function useConsoleLines() {
  const socketConnected = useServerStore((state) => state.socketConnected);
  const [redact] = useRedactAddresses();
  const lines = useRef<Line[]>([]);
  const nextId = useRef(0);
  const [version, setVersion] = useState(0);
  const pending = useRef<number | null>(null);

  useEffect(() => {
    lines.current = [];
    setVersion((v) => v + 1);
  }, [socketConnected, redact]);

  useEffect(
    () => () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
    },
    [],
  );

  const add = (raw: string) => {
    for (const part of (redact ? redactConsoleLine(raw) : raw).split('\n')) {
      const text = cleanLine(part);
      if (!text) continue;
      lines.current.push({ id: nextId.current++, text, level: lineLevel(text) });
    }
    if (lines.current.length > MAX_LINES) lines.current.splice(0, lines.current.length - MAX_LINES);
    // Viele Zeilen auf einmal (Verlauf beim Verbinden) nur einmal zeichnen.
    if (pending.current === null) {
      pending.current = window.setTimeout(() => {
        pending.current = null;
        setVersion((v) => v + 1);
      }, 200);
    }
  };

  useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, (line) => add(line ?? ''));
  useWebsocketEvent(SocketEvent.DAEMON_ERROR, (line) => add(line ?? ''));

  return { lines: lines.current, version };
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + needle.length)}</mark>);
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

function FilteredView({
  lines,
  version,
  level,
  query,
  onClear,
}: {
  lines: Line[];
  version: number;
  level: Level;
  query: string;
  onClear: () => void;
}) {
  const [fontSize] = useUserSetting(CONSOLE_FONT_SIZE_KEY, consoleFontSizeSchema, CONSOLE_FONT_SIZE_DEFAULT);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const needle = query.trim().toLowerCase();
  const { t, tItem } = useExtTranslations();
  const shown = useMemo(
    () =>
      lines.filter(
        (line) => (level === 'all' || line.level === level) && (!needle || line.text.toLowerCase().includes(needle)),
      ),
    [lines, version, level, needle],
  );

  useEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const count = tItem(
    level === 'warn' ? 'consoleWarning' : level === 'error' ? 'consoleError' : 'consoleLine',
    shown.length,
  );
  return (
    <div className='taxz-cfilter'>
      <div className='taxz-cfilter-bar'>
        <span>{needle ? t('console.filter.matching', { count, query: query.trim() }) : count}</span>
        <button type='button' className='taxz-cfilter-clear' onClick={onClear}>
          <FontAwesomeIcon icon={faXmark} aria-hidden='true' />
          {t('console.filter.clear', {})}
        </button>
      </div>
      <div
        ref={list}
        className='taxz-cfilter-list'
        style={{ fontSize }}
        tabIndex={0}
        aria-label={t('console.filter.output', {})}
        onScroll={(event) => {
          const el = event.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {shown.length === 0 ? (
          <p className='taxz-cfilter-none'>{t('console.filter.none', {})}</p>
        ) : (
          shown.map((line) => (
            <div key={line.id} className={`taxz-cline is-${line.level}`}>
              <Highlight text={line.text} query={needle} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Kopfzeile der Konsole: Filter-Segment und Textsuche; die gefilterte Liste liegt ueber der Ausgabe. */
export function ConsoleFilter() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <ConsoleFilterInner /> : null;
}

function ConsoleFilterInner() {
  const { lines, version } = useConsoleLines();
  const [level, setLevel] = useState<Level>('all');
  const [query, setQuery] = useState('');
  const anchor = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const { t } = useExtTranslations();

  const counts = useMemo(() => {
    let warn = 0;
    let error = 0;
    for (const line of lines) {
      if (line.level === 'warn') warn++;
      else if (line.level === 'error') error++;
    }
    return { warn, error };
  }, [lines, version]);

  // Die Ausgabeflaeche der Konsole (Eltern des xterm-Containers); dort haengt die gefilterte Liste darueber.
  useEffect(() => {
    const card = anchor.current?.closest('.mantine-Card-root');
    const xterm = card?.querySelector('.xterm');
    setTarget((xterm?.parentElement?.parentElement as HTMLElement | null) ?? null);
  }, [version]);

  const active = level !== 'all' || query.trim() !== '';
  const options: [Level, string, number | null][] = [
    ['all', t('console.filter.all', {}), null],
    ['warn', t('console.filter.warnings', {}), counts.warn],
    ['error', t('console.filter.errors', {}), counts.error],
  ];

  return (
    <div ref={anchor} className='taxz-chead-tools'>
      <div className='taxz-seg2 is-sm' role='group' aria-label={t('console.filter.label', {})}>
        {options.map(([value, label, count]) => (
          <button
            key={value}
            type='button'
            aria-pressed={level === value}
            className={level === value ? 'is-on' : undefined}
            onClick={() => setLevel(value)}
          >
            {label}
            {count !== null && <span className='taxz-seg-count'>{count}</span>}
          </button>
        ))}
      </div>
      <label className='taxz-csearch'>
        <FontAwesomeIcon icon={faFilter} aria-hidden='true' />
        <input
          type='search'
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
          placeholder={t('console.filter.placeholder', {})}
          aria-label={t('console.filter.searchLabel', {})}
          autoCorrect='off'
          autoCapitalize='none'
          spellCheck={false}
        />
      </label>
      {active &&
        target &&
        createPortal(
          <FilteredView
            lines={lines}
            version={version}
            level={level}
            query={query}
            onClear={() => {
              setLevel('all');
              setQuery('');
            }}
          />,
          target,
        )}
    </div>
  );
}

/** Setzt den Text in die Eingabezeile der Konsole (wie Tippen), ohne abzuschicken. */
function fillInput(from: HTMLElement, command: string) {
  const input = from.closest('.taxz-qcmds')?.parentElement?.querySelector<HTMLInputElement>('input');
  if (!input || input.disabled) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, command);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  input.setSelectionRange(command.length, command.length);
}

/** Schnellbefehle ueber der Eingabezeile: die Befehlskuerzel des Benutzers fuer dieses Egg. */
export function QuickCommands() {
  const isTaxz = useIsTaxz();
  const snippets = useServerStore((state) => state.commandSnippets);
  const disabled = useServerStore((state) => !state.socketConnected || state.state === 'offline');
  const { t, tReact } = useExtTranslations();
  if (!isTaxz) return null;

  return (
    <ServerCan action='control.console'>
      <div className='taxz-qcmds' role='group' aria-label={t('console.quick.label', {})}>
        {snippets.length === 0 ? (
          <span className='taxz-qcmds-hint'>
            {tReact('console.quick.hint', {
              link: <NavLink to='/account/command-snippets'>{t('console.quick.link', {})}</NavLink>,
            })}
          </span>
        ) : (
          snippets.map((snippet) => (
            <button
              key={snippet.uuid}
              type='button'
              className='taxz-qcmd'
              disabled={disabled}
              title={snippet.command}
              onClick={(event) => fillInput(event.currentTarget, snippet.command)}
            >
              {snippet.name}
            </button>
          ))
        )}
      </div>
    </ServerCan>
  );
}

export function registerConsoleTools(ctx: ExtensionContext) {
  ctx.extensionRegistry.enterPages((pages) => {
    pages.server.console.terminalHeaderRightComponents.prependComponent(ConsoleFilter);
    pages.server.console.addTerminalInputRowComponent(QuickCommands);
  });
}
