// Karte "Serverbild" in den Server-Einstellungen (Designvorgabe 9.18, Idee 22): eigenes Bild hochladen (PNG, JPG, WebP),
// Vorschau als Kartenkopf und Server-Symbol, "Ändern", "Entfernen". Ohne Bild gelten die Spielfarben.
// Das Bild wird sofort gespeichert (wie das Profilbild), nicht ueber die Speichern-Leiste.

import { faImage, faTrashCan, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { useMemo, useRef, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { gameLook } from './games.ts';
import { useThemePrefs } from './prefs.ts';
import { ServerArtLayer, ServerEmblem } from './ServerArt.tsx';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, useServerImage, useServerImageActions } from './serverImages.ts';
import { Section } from './TaxzServerSettings.tsx';
import { useExtTranslations } from './translations.ts';

export default function ServerImageSection() {
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const [prefs] = useThemePrefs();
  const look = useMemo(() => gameLook(server.egg), [server.egg]);
  const image = useServerImage(server.uuid);
  const { upload, remove } = useServerImageActions(server.uuid);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useExtTranslations();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError(t('serverImage.wrongType', {}));
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError(t('serverImage.tooLarge', {}));
      return;
    }
    setBusy('upload');
    upload(file)
      .then(() => addToast(t('serverImage.saved', {}), 'success'))
      .catch((err) => setError(httpErrorToHuman(err)))
      .finally(() => {
        setBusy(null);
        if (input.current) input.current.value = '';
      });
  };

  const onRemove = () => {
    setError(null);
    setBusy('remove');
    remove()
      .then(() => addToast(t('serverImage.removed', {}), 'success'))
      .catch((err) => setError(httpErrorToHuman(err)))
      .finally(() => setBusy(null));
  };

  return (
    <Section icon={faImage} title={t('serverImage.title', {})} subtitle={t('serverImage.subtitle', {})}>
      <div className='taxz-simg'>
        <div
          className='taxz-simg-prev'
          aria-label={image ? t('serverImage.previewOwn', {}) : t('serverImage.previewColors', {})}
          role='img'
        >
          <div className={classNames('taxz-simg-art', `taxz-art-${prefs.art}`)}>
            <ServerArtLayer look={look} art={prefs.art} seedText={server.uuid} image={image} />
          </div>
          <ServerEmblem look={look} image={image} />
        </div>
        <div className='taxz-simg-acts'>
          <input
            ref={input}
            type='file'
            accept={IMAGE_TYPES.join(',')}
            className='taxz-sr'
            tabIndex={-1}
            aria-hidden='true'
            onChange={(event) => onFile(event.currentTarget.files?.[0])}
          />
          <button type='button' className='taxz-btn' onClick={() => input.current?.click()} disabled={busy !== null}>
            <FontAwesomeIcon icon={faUpload} aria-hidden='true' />
            {busy === 'upload'
              ? t('serverImage.uploading', {})
              : image
                ? t('serverImage.change', {})
                : t('serverImage.upload', {})}
          </button>
          {image && (
            <button type='button' className='taxz-btn taxz-btn-danger' onClick={onRemove} disabled={busy !== null}>
              <FontAwesomeIcon icon={faTrashCan} aria-hidden='true' />
              {busy === 'remove' ? t('serverImage.removing', {}) : t('serverImage.remove', {})}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className='taxz-verr' role='alert'>
          {error}
        </p>
      )}
      <p className='taxz-hint'>{t('serverImage.hint', {})}</p>
    </Section>
  );
}
