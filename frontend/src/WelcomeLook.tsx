// "Wähle deinen Look" beim ersten Besuch (Designvorgabe 9.2, Idee 2): Einmal pro Benutzer nach der ersten Anmeldung mit taxz
// ein kleines Fenster mit Hintergrund-Kacheln und Akzent-Tupfern. Die Wahl wirkt sofort als Vorschau auf das ganze Panel;
// "Übernehmen" speichert sie, "Später" schliesst ohne Aenderung. Danach erscheint das Fenster nicht wieder (Benutzereinstellung,
// gilt auf allen Geraeten). Wer schon selbst etwas unter "Darstellung" gewaehlt hat, bekommt es nicht.

import classNames from 'classnames';
import { useEffect, useId, useState } from 'react';
import { z } from 'zod';
import { Modal } from '@/elements/modals/Modal.tsx';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useAuth } from '@/providers/contexts/authContext.ts';
import { ACCENT_ORDER, accentText, backgroundText, MiniPreview, Tile } from './AppearancePage.tsx';
import { renderBackdrop } from './backdrop.ts';
import InstallHint from './InstallHint.tsx';
import { type Accent, applyPrefs, BACKGROUNDS, type Background, getEffectivePrefs, useThemePrefs } from './prefs.ts';
import { useExtTranslations } from './translations.ts';

export const WELCOME_KEY = 'de.taxz.theme::welcome_done';
const doneSchema = z.boolean();

function preview(background: Background, accent: Accent) {
  const prefs = { ...getEffectivePrefs(), background, accent };
  applyPrefs(prefs);
  renderBackdrop(prefs.background);
}

function restore() {
  const prefs = getEffectivePrefs();
  applyPrefs(prefs);
  renderBackdrop(prefs.theme === 'taxz' ? prefs.background : null);
}

export default function WelcomeLook() {
  const { user, impersonating } = useAuth();
  const [prefs, update, userPrefs] = useThemePrefs();
  const [done, setDone] = useUserSetting(WELCOME_KEY, doneSchema, false);
  const hasOwnChoice = Object.values(userPrefs).some((value) => value !== undefined);
  const show = !!user && !impersonating && !done && !hasOwnChoice && prefs.theme === 'taxz';
  const [background, setBackground] = useState<Background>(prefs.background);
  const [accent, setAccent] = useState<Accent>(prefs.accent);
  const groupId = useId();
  const { t } = useExtTranslations();

  useEffect(() => {
    if (show) preview(background, accent);
  }, [show, background, accent]);

  if (!show) return <InstallHint enabled={!!user && prefs.theme === 'taxz'} />;

  const later = () => {
    restore();
    setDone(true);
  };
  const apply = () => {
    update({ background, accent });
    setDone(true);
  };
  const name = user.nameFirst || user.username;

  return (
    <Modal
      opened
      onClose={later}
      title={t('welcome.title', { name })}
      size='lg'
      classNames={{ content: 'taxz-welcome' }}
    >
      <div className='taxz-ap taxz-welcome-body'>
        <div className='taxz-tiles taxz-tiles-3' role='radiogroup' aria-label={t('appearance.background.title', {})}>
          {BACKGROUNDS.map((value) => (
            <Tile
              key={value}
              name={`${groupId}-bg`}
              value={value}
              checked={background === value}
              onSelect={setBackground}
              title={backgroundText(value)[0]}
              subtitle={backgroundText(value)[1]}
            >
              <MiniPreview background={value} accent={accent} />
            </Tile>
          ))}
        </div>
        <div className='taxz-swatches' role='radiogroup' aria-label={t('appearance.accent.title', {})}>
          {ACCENT_ORDER.map((value) => (
            <label
              key={value}
              className={classNames('taxz-swatch', accent === value && 'is-on')}
              data-taxz-accent={value}
            >
              <input
                type='radio'
                name={`${groupId}-accent`}
                value={value}
                checked={accent === value}
                onChange={() => setAccent(value)}
                className='taxz-sr'
              />
              <span className='taxz-swatch-dot taxz-preview' data-taxz-accent={value} aria-hidden='true'>
                {accent === value && (
                  <svg viewBox='0 0 16 16'>
                    <path d='M3.5 8.5l3 3 6-7' />
                  </svg>
                )}
              </span>
              {accentText(value)}
            </label>
          ))}
        </div>
        <div className='taxz-welcome-acts'>
          <span className='taxz-welcome-hint'>{t('welcome.hint', {})}</span>
          <button type='button' className='taxz-btn' onClick={later}>
            {t('welcome.later', {})}
          </button>
          <button type='button' className='taxz-btn taxz-btn-primary' onClick={apply}>
            {t('welcome.apply', {})}
          </button>
        </div>
      </div>
    </Modal>
  );
}
