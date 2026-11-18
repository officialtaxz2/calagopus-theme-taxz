// Ersetzt das Modul '@/pages/admin/settings/useSettingsSection.ts' (Designvorgabe 7.5): verhaelt sich genau wie das Original
// und meldet nur das Formular des gerade offenen Einstellungs-Reiters nach jedem Zeichnen weiter. Die Speichern-Leiste
// (TaxzSettingsSaveButton) liest es von dort, denn der Speichern-Knopf des Panels bekommt das Formular nicht mit und wird
// bei gleichen Props nicht neu gezeichnet. Es ist immer nur ein Reiter offen, und jeder hat genau ein solches Formular.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSettingsSection as originalUseSettingsSection } from '@/pages/admin/settings/useSettingsSection.ts';
import type { AnyForm } from './FormSaveBar.tsx';

let current: AnyForm | null = null;
let version = 0;
const listeners = new Set<() => void>();

function publish(form: AnyForm | null) {
  current = form;
  version++;
  listeners.forEach((listener) => listener());
}

/** Formular des offenen Reiters; zeichnet neu, sobald der Reiter neu gezeichnet wurde (also bei jeder Eingabe). */
export function useCurrentSettingsForm(): AnyForm | null {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => version,
  );
  return current;
}

export const useSettingsSection: typeof originalUseSettingsSection = (options) => {
  const result = originalUseSettingsSection(options);
  const form = options.form as AnyForm;
  const latest = useRef(form);
  latest.current = form;
  // Fuer das erste Zeichnen des Knopfs schon jetzt bekannt; Aenderungen danach ueber publish.
  if (current === null) current = form;

  useEffect(() => {
    publish(form);
  });
  useEffect(
    () => () => {
      if (current === latest.current) publish(null);
    },
    [],
  );

  return result;
};
