// Zeitplaene in Klartext (Designvorgabe 9.13, Idee 17): In der Liste steht unter dem Namen jeder Ausloeser als Satz
// ("Jeden Tag um 04:30") und der naechste Lauf in der Zeitzone des Servers. Sonst wie die Zeile des Panels (Kontextmenue,
// Auswahl, Spalten); diese ist hier uebernommen, weil sich nur die Namenszelle aendert. Mit "Standard" die Original-Zeile.

import { faClone, faFileDownload, faPlay, faPlayCircle, faShareAlt, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { dump } from 'js-yaml';
import { forwardRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSchedule from '@/api/server/schedules/deleteSchedule.ts';
import exportSchedule from '@/api/server/schedules/exportSchedule.ts';
import triggerSchedule from '@/api/server/schedules/triggerSchedule.ts';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { downloadTextFile } from '@/lib/download/download.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';
import OriginalScheduleRow from '@/pages/server/schedules/ScheduleRow.tsx';
import ScheduleDuplicateModal from '@/pages/server/schedules/modals/ScheduleDuplicateModal.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';
import { describeTrigger, formatNext, nextRun } from './scheduleText.ts';
import { useExtTranslations } from './translations.ts';

interface ScheduleRowProps {
  schedule: z.infer<typeof serverScheduleSchema>;
  atLimit?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
  onClick?: (event: React.MouseEvent) => void;
}

const TaxzScheduleRow = forwardRef<HTMLTableRowElement, ScheduleRowProps>(function TaxzScheduleRow(
  { schedule, atLimit = false, isSelected = false, onSelectionChange, onClick },
  ref,
) {
  const { t, language } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();
  const navigateUrl = `/server/${server.uuidShort}/schedules/${schedule.uuid}`;
  const timezone = server.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const next = nextRun(schedule.triggers, timezone);

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const doDelete = async () => {
    await deleteSchedule(server.uuid, schedule.uuid)
      .then(() => {
        addToast(t('pages.server.schedules.toast.deleted', {}), 'success');
        setOpenModal(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).schedules.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doExport = (format: 'json' | 'yaml') =>
    exportSchedule(server.uuid, schedule.uuid)
      .then((data) => {
        addToast(t('pages.server.schedules.toast.exported', {}), 'success');

        if (format === 'json') {
          downloadTextFile(JSON.stringify(data, undefined, 2), `schedule-${schedule.uuid}.json`);
        } else {
          downloadTextFile(dump(data, { flowLevel: -1, forceQuotes: true }), `schedule-${schedule.uuid}.yml`);
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  const doTriggerSchedule = (skipCondition: boolean) =>
    triggerSchedule(server.uuid, schedule.uuid, skipCondition)
      .then(() => {
        addToast(t('pages.server.schedules.toast.triggered', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.schedules.modal.deleteSchedule.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.schedules.modal.deleteSchedule.content', { name: schedule.name })}
      </ConfirmationModal>

      <ScheduleDuplicateModal
        schedule={schedule}
        opened={openModal === 'duplicate'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPlay,
            label: t('pages.server.schedules.button.runNow', {}),
            items: [
              {
                type: 'action',
                icon: faPlayCircle,
                label: t('pages.server.schedules.button.runNowWithConditions', {}),
                onClick: () => doTriggerSchedule(false),
                color: 'gray',
              },
              {
                type: 'action',
                icon: faPlay,
                label: t('pages.server.schedules.button.runNowIgnoreConditions', {}),
                onClick: () => doTriggerSchedule(true),
                color: 'gray',
              },
            ],
            disabled: !schedule.enabled,
            canAccess: useServerCan('schedules.update'),
          },
          {
            type: 'action',
            icon: faShareAlt,
            label: t('common.button.export', {}),
            items: [
              {
                type: 'action',
                icon: faFileDownload,
                label: t('common.button.exportAs', { format: 'JSON' }),
                onClick: () => doExport('json'),
                color: 'gray',
              },
              {
                type: 'action',
                icon: faFileDownload,
                label: t('common.button.exportAs', { format: 'YAML' }),
                onClick: () => doExport('yaml'),
                color: 'gray',
              },
            ],
            canAccess: useServerCan('schedules.read'),
          },
          {
            type: 'action',
            icon: faClone,
            label: t('common.button.duplicate', {}),
            onClick: () => setOpenModal('duplicate'),
            disabled: atLimit,
            color: 'gray',
            canAccess: useServerCan('schedules.create'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useServerCan('schedules.delete'),
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            className='cursor-pointer'
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
            onClick={(e) => {
              onClick?.(e);
              if (!e.defaultPrevented) navigate(navigateUrl);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={schedule.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <div className='taxz-sched'>
                <b className='taxz-sched-name'>{schedule.name}</b>
                <span className='taxz-sched-when'>
                  {schedule.triggers.length === 0
                    ? tExt('schedule.manualOnly', {})
                    : schedule.triggers.map((trigger) => describeTrigger(trigger, language)).join(' · ')}
                </span>
                {next && (
                  <span className='taxz-sched-next'>
                    {schedule.enabled ? tExt('schedule.nextRun', { when: formatNext(next, timezone) }) : tExt('schedule.paused', {})}
                  </span>
                )}
              </div>
            </TableData>

            <TableData>
              {schedule.lastRun ? <FormattedTimestamp timestamp={schedule.lastRun} /> : t('common.na', {})}
            </TableData>

            <TableData>
              {schedule.lastFailure ? <FormattedTimestamp timestamp={schedule.lastFailure} /> : t('common.na', {})}
            </TableData>

            <TableData>
              <Badge className='w-max!' color={schedule.enabled ? 'green' : 'red'}>
                {schedule.enabled ? t('common.badge.active', {}) : t('common.badge.inactive', {})}
              </Badge>
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={schedule.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

const ScheduleRow = forwardRef<HTMLTableRowElement, ScheduleRowProps>(function ScheduleRow(props, ref) {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzScheduleRow ref={ref} {...props} /> : <OriginalScheduleRow ref={ref} {...props} />;
});

export default ScheduleRow;
