// Als App aufs Handy (Designvorgabe 9.20, Idee 24): theme-color folgt dem Akzent, und am Handy erscheint einmal ein
// schliessbarer Hinweis "Zum Startbildschirm hinzufügen". Bietet der Browser die Installation an (Android/Chrome), installiert
// der Knopf direkt; sonst (iPhone/Safari) steht dort der Weg ueber "Teilen". Gemerkt wird das Schliessen auf diesem Geraet.
// App-Symbol und Startbild der installierten App kommen aus den Admin-Einstellungen des Panels (Metadaten / PWA).

import { faMobileScreenButton, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import { isTaxzActive } from './prefs.ts';
import { useExtTranslations } from './translations.ts';

const HINT_KEY = 'de.taxz.theme::install_hint_done';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let originalThemeColor: string | null = null;

/** Fruehzeitig (beim Start) registrieren, sonst ist das Ereignis schon vorbei. */
export function registerInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Mit "Standard" bleibt das Verhalten des Browsers unveraendert (eigene Installationsleiste).
    if (!isTaxzActive()) return;
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    safeLocalStorageSet(HINT_KEY, '1');
    listeners.forEach((listener) => listener());
  });
}

/** theme-color der Browserleiste: im taxz-Theme die Akzentfarbe, sonst der Wert des Panels. */
export function applyThemeColor(attempt = 0) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  if (originalThemeColor === null) originalThemeColor = meta.content;
  if (!isTaxzActive()) {
    meta.content = originalThemeColor;
    return;
  }
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  if (accent) meta.content = accent;
  // Das Theme-CSS kann beim allerersten Aufruf noch fehlen; dann kurz danach erneut.
  else if (attempt < 20) window.requestAnimationFrame(() => applyThemeColor(attempt + 1));
}

function isPhone() {
  return window.matchMedia('(max-width: 640px)').matches && window.matchMedia('(pointer: coarse)').matches;
}

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function InstallHint({ enabled }: { enabled: boolean }) {
  const [done, setDone] = useState(() => safeLocalStorageGet(HINT_KEY) === '1');
  const [, rerender] = useState(0);
  const { t } = useExtTranslations();

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!enabled || done || !isPhone() || isInstalled()) return null;
  if (!deferred && !isIos()) return null;

  const close = () => {
    safeLocalStorageSet(HINT_KEY, '1');
    setDone(true);
  };

  return (
    <aside className='taxz-install' aria-label={t('install.label', {})}>
      <span className='taxz-install-ic' aria-hidden='true'>
        <FontAwesomeIcon icon={faMobileScreenButton} />
      </span>
      <div className='taxz-install-body'>
        <b>{t('install.title', {})}</b>
        <span>{deferred ? t('install.text', {}) : t('install.ios', {})}</span>
      </div>
      {deferred && (
        <button
          type='button'
          className='taxz-btn taxz-btn-primary'
          onClick={() => {
            deferred?.prompt();
            deferred?.userChoice.finally(close);
          }}
        >
          {t('install.add', {})}
        </button>
      )}
      <button type='button' className='taxz-ib' aria-label={t('install.close', {})} onClick={close}>
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </aside>
  );
}
