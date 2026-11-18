// Zustand "Verbindung weg" (Designvorgabe 8.): Leiste oben im Inhalt in --warn 14 %:
// "Verbindung zum Server unterbrochen, verbinde neu …" mit Knopf "Jetzt verbinden". Andere Fehler der Live-Verbindung
// (keine Berechtigung, Anmeldung, Daemon) zeigen die Meldung des Panels in derselben Leiste, rot wenn nicht behebbar.
// Mit "Standard" das Original-Banner.

import { faPlugCircleExclamation, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import OriginalBanner from '@/pages/server/WebsocketStatusBanner.tsx';
import { SocketErrorType } from '@/plugins/websocket/Websocket.ts';
import { useServerStore } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';
import { useExtTranslations } from './translations.ts';

function TaxzBanner() {
  const socketError = useServerStore((state) => state.socketError);
  const setSocketError = useServerStore((state) => state.setSocketError);
  const transferring = useServerStore((state) => state.server.isTransferring);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { t } = useExtTranslations();

  useEffect(() => {
    if (!socketError?.nextRetryMs) {
      setCountdown(null);
      return;
    }
    let remaining = Math.ceil(socketError.nextRetryMs / 1000);
    setCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining > 0 ? remaining : null);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [socketError?.nextRetryMs, socketError?.reconnectAttempt]);

  if (!socketError) return null;
  if (socketError.type === SocketErrorType.PERMISSION_DENIED && transferring) return null;

  const lost =
    socketError.recoverable &&
    (socketError.type === SocketErrorType.CONNECTION_LOST || socketError.type === SocketErrorType.CONNECTION_FAILED);
  const text = lost
    ? countdown
      ? t('socket.lostRetry', { seconds: countdown })
      : t('socket.lost', {})
    : socketError.message;
  if (!text) return null;

  return (
    <div className={socketError.recoverable ? 'taxz-connbar' : 'taxz-connbar is-bad'} role='status'>
      <FontAwesomeIcon icon={lost ? faPlugCircleExclamation : faTriangleExclamation} aria-hidden='true' />
      <span className='taxz-connbar-text'>{text}</span>
      {socketError.retry && (
        <button type='button' className='taxz-btn' onClick={socketError.retry}>
          {t('socket.connectNow', {})}
        </button>
      )}
      {socketError.type === SocketErrorType.DAEMON_ERROR && (
        <button
          type='button'
          className='taxz-ib'
          onClick={() => setSocketError(null)}
          aria-label={t('socket.close', {})}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
    </div>
  );
}

export default function WebsocketStatusBanner() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzBanner /> : <OriginalBanner />;
}
