// Bausteine fuer Zustaende (Designvorgabe 8.): Laden als Skelett in Form der Serverkarte, Leer mit Symbol in Kachel,
// Fehler als Karte mit Rand --bad 40 % und "Erneut versuchen". Haengt als Render-Interceptor an den Panel-Elementen
// EmptyState, ErrorState und Spinner.Centered; mit "Standard" rendert jeweils das Original.

import { faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ComponentProps, ReactElement } from 'react';
import { useLocation } from 'react-router';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { useIsTaxz, useThemePrefs } from './prefs.ts';

type EmptyProps = ComponentProps<typeof EmptyState>;
type ErrorProps = ComponentProps<typeof ErrorState>;

function TaxzEmpty({ element, props }: { element: ReactElement; props: EmptyProps }) {
  const isTaxz = useIsTaxz();
  if (!isTaxz) return element;
  return (
    <div className={props.flush ? 'taxz-state is-flush' : 'taxz-state'}>
      <span className='taxz-state-ic' aria-hidden='true'>
        <FontAwesomeIcon icon={props.icon} />
      </span>
      <h3 className='taxz-state-title'>{props.title}</h3>
      <div className='taxz-state-text'>{props.description}</div>
      {props.children && <div className='taxz-state-acts'>{props.children}</div>}
    </div>
  );
}

function TaxzError({ element, props }: { element: ReactElement; props: ErrorProps }) {
  const isTaxz = useIsTaxz();
  if (!isTaxz) return element;
  return (
    <div className='taxz-state is-error' role='alert'>
      <span className='taxz-state-ic' aria-hidden='true'>
        <FontAwesomeIcon icon={faTriangleExclamation} />
      </span>
      <h3 className='taxz-state-title'>Das hat nicht geklappt</h3>
      <div className='taxz-state-text'>
        <p>{props.error}</p>
        {props.onRetry && <p>Prüfe die Verbindung und versuche es noch einmal.</p>}
      </div>
      {props.onRetry && (
        <div className='taxz-state-acts'>
          <button type='button' className='taxz-btn' onClick={props.onRetry} disabled={props.retrying}>
            <FontAwesomeIcon icon={faRotateRight} aria-hidden='true' />
            {props.retrying ? 'Versucht erneut …' : 'Erneut versuchen'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Skelett einer Serverkarte: Kopf, Symbol, zwei Zeilen, drei Kennzahlen, Knopf. */
export function ServerCardSkeleton() {
  return (
    <div className='taxz-skel-card' aria-hidden='true'>
      <div className='taxz-skel taxz-skel-art' />
      <div className='taxz-skel-body'>
        <div className='taxz-skel taxz-skel-emb' />
        <div className='taxz-skel taxz-skel-line w60' />
        <div className='taxz-skel taxz-skel-line w40' />
        <div className='taxz-skel-stats'>
          <div className='taxz-skel' />
          <div className='taxz-skel' />
          <div className='taxz-skel' />
        </div>
        <div className='taxz-skel taxz-skel-btn' />
      </div>
    </div>
  );
}

function TaxzCenteredSpinner({ element }: { element: ReactElement }) {
  const isTaxz = useIsTaxz();
  const [prefs] = useThemePrefs();
  const { pathname } = useLocation();
  // Nur die Serverliste hat ein festes Kartenbild; andere Stellen behalten den Lade-Kreis in Akzentfarbe.
  if (!isTaxz || pathname !== '/') return element;
  return (
    <div className={prefs.serverView === 'list' ? 'taxz-skel-grid is-list' : 'taxz-skel-grid'} role='status'>
      <span className='taxz-sr'>Server werden geladen …</span>
      <ServerCardSkeleton />
      <ServerCardSkeleton />
      <ServerCardSkeleton />
    </div>
  );
}

export function registerStateHooks() {
  EmptyState.addRenderInterceptor((element, props) => <TaxzEmpty element={element} props={props} />);
  ErrorState.addRenderInterceptor((element, props) => <TaxzError element={element} props={props} />);
  Spinner.Centered.addRenderInterceptor((element) => <TaxzCenteredSpinner element={element} />);
}
