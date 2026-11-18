// Farben der Konsolenausgabe (Designvorgabe 3.5): Zeitstempel gedimmt, Zeilen mit WARN im --warn-Ton, mit ERROR/SEVERE/FATAL
// im --bad-Ton (dunkle Varianten, weil die Konsole immer dunkel ist). Nur fuer Zeilen, die das Spiel nicht schon selbst
// einfaerbt (keine Steuerzeichen); Text, Suche und Kopieren bleiben unveraendert. Nur im taxz-Theme.

import type { ExtensionContext } from 'shared';
import { lineLevel } from './consoleLevel.ts';
import { isTaxzActive } from './prefs.ts';

const WARN = '\x1b[38;2;255;201;92m';
const ERROR = '\x1b[38;2;255;138;130m';
const DIM = '\x1b[38;2;157;150;165m';
const RESET = '\x1b[39m';
const TIME = /^(\[?(?:\d{4}-\d{2}-\d{2}[ T])?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\]?)/;

export function colorLine(line: string) {
  if (!line || line.includes('\x1b')) return line;
  const level = lineLevel(line);
  const body = level === 'warn' ? `${WARN}${line}${RESET}` : level === 'error' ? `${ERROR}${line}${RESET}` : line;
  if (level !== 'info') return body;
  return body.replace(TIME, `${DIM}$1${RESET}`);
}

export function registerConsoleColors(ctx: ExtensionContext) {
  ctx.extensionRegistry.enterPages((pages) => {
    pages.server.console.xterm.addBeforePluginsHandler((term) => {
      const write = term.write.bind(term);
      term.write = (data, callback) => {
        if (typeof data !== 'string' || !isTaxzActive()) return write(data, callback);
        return write(data.split('\n').map(colorLine).join('\n'), callback);
      };
    });
  });
}
