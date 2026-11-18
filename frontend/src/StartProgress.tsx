// Startvorgang sichtbar (Designvorgabe 9.5, Idee 6): Waehrend "Startet" zeigt der Server-Kopf die verstrichene Zeit
// und die letzte Konsolenzeile. Meldet das Panel danach "Laeuft" (Startmeldung des Eggs), kommt eine kurze Erfolgsmeldung.
// Nutzt nur Status und Konsolenausgabe, also fuer jedes Spiel gleich.

import { useEffect, useRef, useState } from 'react';
import { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import useWebsocketEvent from '@/plugins/websocket/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { getExtTranslations, useExtTranslations } from './translations.ts';

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export function cleanLine(line: string) {
  return line.replace(ANSI, '').replace(/\r/g, '').trim();
}

function elapsed(ms: number) {
  const { t } = getExtTranslations();
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60
    ? t('card.startingSeconds', { seconds: s })
    : t('card.startingMinutes', { minutes: Math.floor(s / 60), seconds: s % 60 });
}

export default function StartProgress() {
  const state = useServerStore((s) => s.state);
  const name = useServerStore((s) => s.server.name);
  const containerUptime = useServerStore((s) => s.stats?.uptime ?? null);
  const { addToast } = useToast();
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastLine, setLastLine] = useState('');
  const previous = useRef<string | null>(null);
  const { t } = useExtTranslations();

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (state === 'starting' && before !== 'starting') {
      setSince(Date.now());
      setLastLine('');
    }
    if (state !== 'starting') setSince(null);
    if (state === 'running' && before === 'starting') addToast(t('start.running', { name }), 'success');
  }, [state, name, addToast]);

  useEffect(() => {
    if (since === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);

  useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, (line) => {
    if (since === null) return;
    const text = cleanLine(line ?? '');
    if (text) setLastLine(text);
  });

  if (since === null) return null;
  return (
    <div className='taxz-startline'>
      {/* Nur Beginn ("startet") und Ende (Meldung "läuft") werden vorgelesen, nicht der Sekundenzähler und jede Konsolenzeile. */}
      <span className='taxz-sr' role='status'>
        {t('start.starting', { name })}
      </span>
      <span className='taxz-startline-time' aria-hidden='true'>
        {elapsed(containerUptime || now - since)}
      </span>
      {lastLine && (
        <span className='taxz-startline-last taxz-mono' aria-hidden='true'>
          {lastLine}
        </span>
      )}
    </div>
  );
}
