// Status im Browser-Tab (Designvorgabe 9.10, Idee 11): Auf den Seiten eines Servers lautet der Tab-Titel
// "● Läuft · Servername", das Tab-Bild bekommt einen Punkt in der Statusfarbe. Kommen neue Warnungen oder Fehler in der
// Konsole an, waehrend der Tab im Hintergrund ist, steht ihre Zahl davor: "(2) ● Läuft · Servername".
// Nutzt nur Status und Konsolenausgabe, also fuer jedes Spiel gleich. Beim Verlassen kommen Titel und Bild des Panels zurueck.

import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useWebsocketEvent, { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { useServerStore } from '@/stores/server.ts';
import { lineLevel } from './consoleLevel.ts';
import { useCurrentServerStatus } from './CrashHelp.tsx';
import { cleanLine } from './StartProgress.tsx';
import { type Tone } from './serverStatus.ts';

// Kraeftige Farben, damit der Punkt auf hellen und dunklen Tab-Leisten erkennbar ist.
const DOT: Record<Tone, string> = {
  ok: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
  off: '#9ca3af',
  info: '#3b82f6',
};

function iconLinks() {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawIcon(base: string, color: string) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const img = await loadImage(base);
  if (img) g.drawImage(img, 0, 0, size, size);
  g.beginPath();
  g.arc(size * 0.74, size * 0.74, size * 0.24, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = size * 0.07;
  g.strokeStyle = '#ffffff';
  g.stroke();
  try {
    return canvas.toDataURL('image/png');
  } catch {
    // Fremdes App-Symbol ohne CORS: nur der Punkt.
    g.clearRect(0, 0, size, size);
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    return canvas.toDataURL('image/png');
  }
}

export default function TabStatus() {
  const { server, state } = useServerStore(useShallow((s) => ({ server: s.server, state: s.state })));
  const { status } = useCurrentServerStatus(server, state);
  const [unseen, setUnseen] = useState(0);
  const panelTitle = useRef(document.title);
  const ours = useRef('');

  useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, (line) => {
    if (!document.hidden) return;
    if (lineLevel(cleanLine(line ?? '')) !== 'info') setUnseen((n) => n + 1);
  });

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setUnseen(0);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Titel: das Panel setzt ihn bei jedem Seitenwechsel neu; dann merken und wieder den eigenen setzen.
  const title = `${unseen > 0 ? `(${unseen}) ` : ''}● ${status.label} · ${server.name}`;
  useEffect(() => {
    ours.current = title;
    if (document.title !== title) document.title = title;
    const el = document.querySelector('title');
    if (!el) return;
    const observer = new MutationObserver(() => {
      if (document.title === ours.current) return;
      panelTitle.current = document.title;
      document.title = ours.current;
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [title]);

  useEffect(
    () => () => {
      ours.current = '';
      document.title = panelTitle.current;
    },
    [],
  );

  // Tab-Bild mit Statuspunkt
  const originals = useRef<Map<HTMLLinkElement, string> | null>(null);
  useEffect(() => {
    const links = iconLinks();
    if (links.length === 0) return;
    if (!originals.current) originals.current = new Map(links.map((link) => [link, link.href]));
    const base = originals.current.get(links[0]) ?? links[0].href;
    let cancelled = false;
    drawIcon(base, DOT[status.tone]).then((url) => {
      if (cancelled || !url) return;
      for (const link of links) link.href = url;
    });
    return () => {
      cancelled = true;
    };
  }, [status.tone]);

  useEffect(
    () => () => {
      originals.current?.forEach((href, link) => {
        link.href = href;
      });
    },
    [],
  );

  return null;
}
