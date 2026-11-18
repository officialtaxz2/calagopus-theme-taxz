// Einstufung einer Konsolenzeile nach den spielunabhaengigen Schluesselwoertern (Designvorgabe 9.6):
// WARN/WARNING = Warnung, ERROR/SEVERE/FATAL = Fehler. Nur ganze Woerter, Gross-/Kleinschreibung egal.

export type LineLevel = 'info' | 'warn' | 'error';

const ERROR_WORD = /\b(error|severe|fatal)\b/i;
const WARN_WORD = /\b(warn|warning)\b/i;

export function lineLevel(text: string): LineLevel {
  if (ERROR_WORD.test(text)) return 'error';
  if (WARN_WORD.test(text)) return 'warn';
  return 'info';
}
