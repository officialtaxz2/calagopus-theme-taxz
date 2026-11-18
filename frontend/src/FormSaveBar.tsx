// Speichern-Leiste (Designvorgabe 7.5) fuer ein einzelnes Formular des Panels, z. B. Konto oder Admin-Einstellungen:
// zaehlt die geaenderten Felder gegen den zuletzt gespeicherten Stand, "Verwerfen" stellt diesen wieder her,
// "Speichern" sendet das Formular ab (so bleiben Pruefung, Rueckfragen und Meldungen des Panels unveraendert).

import type { UseFormReturnType } from '@mantine/form';
import isEqual from 'fast-deep-equal';
import SaveBar from './SaveBar.tsx';

// oxlint-disable-next-line no-explicit-any
export type AnyForm = UseFormReturnType<any>;

/** Anzahl der oberen Formularfelder, die vom gespeicherten Stand abweichen. */
export function countChanges(form: AnyForm): number {
  const values = (form.getValues() ?? {}) as Record<string, unknown>;
  const saved = (form.getInitialValues() ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(values), ...Object.keys(saved)]);
  let count = 0;
  for (const key of keys) if (!isEqual(values[key], saved[key])) count++;
  return count;
}

export function discardChanges(form: AnyForm) {
  form.setValues(form.getInitialValues());
  form.clearErrors();
}

export default function FormSaveBar({ form, loading, canSave }: { form: AnyForm; loading: boolean; canSave: boolean }) {
  return (
    <SaveBar count={countChanges(form)} saving={loading} canSave={canSave} onDiscard={() => discardChanges(form)} submit />
  );
}
