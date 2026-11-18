// Ankuendigungen als Banner (Designvorgabe 9.17, Idee 21): Die Ankuendigungen aus dem Admin-Bereich oben im Inhalt, farbig
// nach Art (Info Akzent, Erfolg --ok, Wartung/Warnung --warn, Stoerung --bad), mit Symbol und Schliessen. Geschlossen wird
// pro Benutzer und Ankuendigung gemerkt (Benutzereinstellung, gilt auf allen Geraeten); eine zeitlich begrenzte
// Schliessbarkeit des Panels (dismissibleEnd) gilt weiter. Mit "Standard" der Hinweis des Panels.

import type { ComponentProps } from 'react';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import OriginalAnnouncementAlert from '@/elements/DismissibleAnnouncementAlert.tsx';
import { announcementTypeIconMapping } from '@/lib/enums.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useIsTaxz } from './prefs.ts';
import { useExtTranslations } from './translations.ts';

type Props = ComponentProps<typeof OriginalAnnouncementAlert>;
type Announcement = Props['announcement'];

const DISMISSED_KEY = 'de.taxz.theme::dismissed_announcements';
const dismissedSchema = z.record(z.string(), z.string());

const TONE: Record<Announcement['type'], string> = {
  info: 'is-info',
  success: 'is-ok',
  warning: 'is-warn',
  error: 'is-bad',
};

function stillOpenable(announcement: Announcement) {
  return announcement.dismissibleEnd === null || new Date(announcement.dismissibleEnd) > new Date();
}

function TaxzBanner({ announcement }: Props) {
  const { language } = useTranslations();
  const { t } = useExtTranslations();
  const [dismissed, setDismissed] = useUserSetting(DISMISSED_KEY, dismissedSchema, {});
  const marker = announcement.dismissibleEnd ?? 'null';
  const canClose = announcement.dismissible && stillOpenable(announcement);

  if (announcement.dismissible && dismissed[announcement.uuid] === marker && stillOpenable(announcement)) return null;

  return (
    <div className={`taxz-banner ${TONE[announcement.type]}`} role='status'>
      <span className='taxz-banner-ic' aria-hidden='true'>
        <FontAwesomeIcon icon={announcementTypeIconMapping[announcement.type]} />
      </span>
      <div className='taxz-banner-body'>
        <b className='taxz-banner-title'>{announcement.titleTranslations[language] ?? announcement.title}</b>
        <div className='taxz-banner-text'>
          {(announcement.contentTranslations[language] ?? announcement.content).md()}
        </div>
      </div>
      {canClose && (
        <button
          type='button'
          className='taxz-ib'
          aria-label={t('announcement.close', {})}
          onClick={() => setDismissed((previous) => ({ ...previous, [announcement.uuid]: marker }))}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
    </div>
  );
}

export default function DismissibleAnnouncementAlert(props: Props) {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzBanner {...props} /> : <OriginalAnnouncementAlert {...props} />;
}
