// Rueckgaengig statt Rueckfrage (Designvorgabe 9.7, Idee 9): Ist der Papierkorb fuer diesen Ort aktiv, verschiebt das
// taxz-Theme die Dateien ohne Dialog in den Papierkorb und zeigt die Meldung mit "Rückgängig" des Panels.
// Wo nichts wiederherstellbar ist (Papierkorb aus, Mounts), bleibt der Dialog des Panels unveraendert.
// Wings legt nur Dateien, die auf einem anderen Dateisystem als dem des Servers liegen (Mounts), nicht in den
// Papierkorb; das Panel loescht diese dann endgueltig. Damit das nie ohne Rueckfrage passiert, zeigt das Theme den
// Dialog auch, sobald unter der Auswahl ein Mount-Eintrag (virtual) oder eine Verknuepfung (symlink) ist, denn eine
// Verknuepfung kann auf einen Mount zeigen.
// Endgueltig loeschen geht weiter ueber den Papierkorb selbst. Mit "Standard" immer der Original-Dialog.

import { type ComponentProps, useEffect, useRef } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteFiles from '@/api/server/files/deleteFiles.ts';
import restoreTrashEntries from '@/api/server/files/trash/restoreTrashEntries.ts';
import { isTrashEnabled } from '@/lib/domain/server.ts';
import { createUndoAction } from '@/lib/files/undoableFileMutation.ts';
import OriginalFileDeleteModal from '@/pages/server/files/modals/FileDeleteModal.tsx';
import { useUndoableToast } from '@/plugins/toast/useUndoableToast.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope } from '@/stores/undoHistory.ts';
import { useIsTaxz } from './prefs.ts';

type Props = ComponentProps<typeof OriginalFileDeleteModal>;

function canTrashWithoutDialog(files: Props['files']): boolean {
  return files.every((file) => !file.virtual && !file.symlink);
}

function TrashWithoutDialog({ files, opened, onClose }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addUndoableToast = useUndoableToast(fileManagerUndoScope(server.uuid));
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);
  const invalidateFilemanager = useFileManager((state) => state.invalidateFilemanager);
  const running = useRef(false);

  useEffect(() => {
    if (!opened || running.current) return;
    if (files.length === 0) {
      onClose();
      return;
    }
    running.current = true;
    deleteFiles(
      server.uuid,
      browsingDirectory,
      files.map((file) => file.name),
      false,
    )
      .then(({ deleted, entries }) => {
        if (entries.length > 0) {
          const trashedFiles = tItem('file', entries.length);
          addUndoableToast(
            deleted > entries.length
              ? t('pages.server.files.toast.filesTrashedPartiallyDeleted', {
                  files: trashedFiles,
                  deleted: tItem('file', deleted - entries.length),
                })
              : t('pages.server.files.toast.filesTrashed', { files: trashedFiles }),
            createUndoAction(
              () => restoreTrashEntries({ uuid: server.uuid, entries: entries.map((entry) => ({ uuid: entry.uuid })) }),
              (result) => result.restored.length,
              {
                addToast,
                invalidateFilemanager,
                cannotUndoMessage: t('pages.server.files.toast.trashCouldNotBeUndone', {}),
                undoneMessage: (count) => t('pages.server.files.toast.trashUndone', { files: tItem('file', count) }),
                onError: (msg) => addToast(httpErrorToHuman(msg), 'error'),
              },
            ),
          );
        } else {
          addToast(t('pages.server.files.toast.filesDeleted', {}), 'success');
        }
        doSelectFiles([]);
        invalidateFilemanager();
      })
      .catch((error) => addToast(httpErrorToHuman(error), 'error'))
      .finally(() => {
        running.current = false;
        onClose();
      });
  }, [opened]);

  return null;
}

export default function FileDeleteModal(props: Props) {
  const isTaxz = useIsTaxz();
  const server = useServerStore((state) => state.server);
  const browsingPrimaryFilesystem = useFileManager((state) => state.browsingPrimaryFilesystem);
  if (isTaxz && isTrashEnabled(server, browsingPrimaryFilesystem) && canTrashWithoutDialog(props.files)) {
    return <TrashWithoutDialog {...props} />;
  }
  return <OriginalFileDeleteModal {...props} />;
}
