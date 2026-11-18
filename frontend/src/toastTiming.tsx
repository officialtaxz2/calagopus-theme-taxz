// Anzeigedauer der Meldungen (Designvorgabe 8): im taxz-Theme bleibt eine Erfolgsmeldung 4 s, eine Erfolgsmeldung mit Aktion
// (z. B. "Rückgängig") 8 s, und eine Fehlermeldung bleibt, bis man sie schliesst. Warnungen und Hinweise behalten die Dauer
// des Panels (dort gibt es auch Warnungen, die bewusst stehen bleiben). Mit "Standard" bleibt alles beim Panel.
//
// Das Panel schliesst Meldungen nach 7,5 s ("timeout"); dieses Schliessen laesst sich ueber die Ereignisse der Erweiterung
// abbrechen. Zum frueheren Schliessen braucht es dismissToast aus dem ToastProvider; das liefert eine kleine Komponente,
// die global (innerhalb des Providers) eingehaengt wird.

import { useEffect } from 'react';
import type { ExtensionContext } from 'shared';
import { useToast } from '@/providers/ToastProvider.tsx';
import { isTaxzActive } from './prefs.ts';

export const SUCCESS_MS = 4000;
export const WITH_ACTION_MS = 8000;

const dismissers = new Set<(id: number) => void>();
const timers = new Map<number, number>();

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) window.clearTimeout(timer);
  timers.delete(id);
}

/** Wie lange eine neue Meldung stehen bleibt: Zahl = eigene Dauer, null = bis geschlossen, undefined = wie im Panel. */
export function taxzToastDuration(type: string, actionCount: number): number | null | undefined {
  if (type === 'error') return null;
  if (type !== 'success') return undefined;
  return actionCount > 0 ? WITH_ACTION_MS : SUCCESS_MS;
}

function DismissBridge() {
  const { dismissToast } = useToast();
  useEffect(() => {
    dismissers.add(dismissToast);
    return () => {
      dismissers.delete(dismissToast);
    };
  }, [dismissToast]);
  return null;
}

export function registerToastTiming(ctx: ExtensionContext) {
  ctx.extensionRegistry.enterGlobal((global) => global.appendComponent(DismissBridge));

  ctx.extensionRegistry.enterEvents((events) => {
    events.toast.addShowHandler((event) => {
      if (event.kind !== 'toast' || !isTaxzActive()) return;
      const duration = taxzToastDuration(event.data.type, event.data.actions?.length ?? 0);
      if (typeof duration !== 'number') return;
      const id = event.id;
      timers.set(
        id,
        window.setTimeout(() => {
          timers.delete(id);
          const dismiss = dismissers.values().next().value;
          dismiss?.(id);
        }, duration),
      );
    });

    events.toast.addDismissHandler((event) => {
      if (event.reason !== 'timeout') {
        clearTimer(event.id);
        return;
      }
      if (!isTaxzActive()) return;
      // Eigene Dauer laeuft noch (8 s) oder Fehler: das Schliessen des Panels nach 7,5 s abbrechen.
      if (timers.has(event.id) || event.toast.type === 'error') event.cancel();
    });
  });
}
