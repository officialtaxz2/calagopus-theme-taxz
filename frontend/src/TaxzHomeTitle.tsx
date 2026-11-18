// Seitenkopf der Serverliste (Designvorgabe 7.1): Kicker, Titel, Unterzeile mit Anzahl, rechts Umschalter Karten/Liste.
// Darunter bleiben die Reiter "Alle Server" / "Gruppierte Server" des Standard-Panels. Mit "Standard" das Original.

import { faGrip, faList } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import OriginalHomeTitle from '@/pages/dashboard/home/DashboardHomeTitle.tsx';
import { useIsTaxz, useThemePrefs } from './prefs.ts';
import { useVisibleServerCounts } from './serverStatus.ts';
import { useExtTranslations } from './translations.ts';

function TaxzHomeTitle() {
  const [prefs, update] = useThemePrefs();
  const { total, active } = useVisibleServerCounts();
  const { t, tItem } = useExtTranslations();

  const sub = total === 0 ? t('home.empty', {}) : t('home.count', { servers: tItem('server', total), active });

  return (
    <>
      <header className='taxz-phead'>
        <div>
          <p className='taxz-kicker'>{t('nav.group.overview', {})}</p>
          <h1 className='taxz-h1'>{t('nav.servers', {})}</h1>
          <p className='taxz-sub' aria-live='polite'>
            {sub}
          </p>
        </div>
        <div className='taxz-seg2' role='group' aria-label={t('appearance.view.label', {})}>
          <button
            type='button'
            aria-pressed={prefs.serverView === 'cards'}
            className={prefs.serverView === 'cards' ? 'is-on' : undefined}
            onClick={() => update({ serverView: 'cards' })}
          >
            <FontAwesomeIcon icon={faGrip} />
            {t('look.view.cards', {})}
          </button>
          <button
            type='button'
            aria-pressed={prefs.serverView === 'list'}
            className={prefs.serverView === 'list' ? 'is-on' : undefined}
            onClick={() => update({ serverView: 'list' })}
          >
            <FontAwesomeIcon icon={faList} />
            {t('look.view.list', {})}
          </button>
        </div>
      </header>
      <OriginalHomeTitle />
    </>
  );
}

export default function DashboardHomeTitle() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzHomeTitle /> : <OriginalHomeTitle />;
}
