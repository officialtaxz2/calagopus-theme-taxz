// Gemeinsame Speichern-Leiste (Designvorgabe 7.5): erscheint, sobald etwas geaendert ist:
// "2 ungespeicherte Änderungen · Verwerfen · Speichern". Klebt unten im Inhalt, am Handy ueber der Tab-Leiste.

import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function SaveBar({
  count,
  saving,
  canSave,
  onDiscard,
  onSave,
  submit = false,
}: {
  count: number;
  saving: boolean;
  canSave: boolean;
  onDiscard: () => void;
  onSave?: () => void;
  /** Speichern als Absende-Knopf des umgebenden Formulars (dessen Pruefung und Rueckfragen bleiben dann erhalten). */
  submit?: boolean;
}) {
  if (count === 0 && !saving) return null;
  return (
    <div className='taxz-savebar' role='region' aria-label='Ungespeicherte Änderungen'>
      <span className='taxz-savebar-text' aria-live='polite'>
        <span className='taxz-savebar-dot' aria-hidden='true' />
        {count === 1 ? '1 ungespeicherte Änderung' : `${count} ungespeicherte Änderungen`}
      </span>
      <div className='taxz-savebar-acts'>
        <button type='button' className='taxz-btn' onClick={onDiscard} disabled={saving}>
          Verwerfen
        </button>
        <button
          type={submit ? 'submit' : 'button'}
          className='taxz-btn taxz-btn-primary'
          onClick={submit ? undefined : onSave}
          disabled={saving || !canSave}
        >
          <FontAwesomeIcon icon={faCheck} aria-hidden='true' />
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
