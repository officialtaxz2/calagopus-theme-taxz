// Zeitplaene in Klartext, Anlegen (Designvorgabe 9.13, Idee 17): Wiederholung als Segment (Taeglich, Woechentlich, Stuendlich,
// dazu Monatlich und Minuetlich, die das Panel ebenfalls kann) plus Uhrzeit; darunter der Satz ("Jeden Tag um 04:30") und klein
// der Cron-Ausdruck. "Erweitert" laesst den Ausdruck wie im Panel direkt bearbeiten. Uebernommen aus dem Formular des Panels,
// nur die Auswahl der Wiederholung und die Zusammenfassung sind anders. Mit "Standard" das Original.

import { useMemo, useState } from 'react';
import type { TriggerFormProps } from '@/pages/server/schedules/triggers/TriggerForm.tsx';
import { CrontabEditor } from '@/elements/input/CronInput.tsx';
import DatePicker from '@/elements/input/DatePicker.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TimeInput from '@/elements/input/TimeInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import {
  CRON_WEEKDAYS,
  getLocalizedCronWeekdays,
  parseSimpleSchedule,
  SimpleSchedule,
  simpleScheduleToCron,
} from '@/lib/cron.ts';
import { isValidCronExpression } from '@/lib/schemas/server/schedules.ts';
import OriginalCronTriggerExtraForm from '@/pages/server/schedules/triggers/CronTriggerExtraForm.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';
import { describeCronPlain } from './scheduleText.ts';
import { useExtTranslations } from './translations.ts';

function TaxzCronTriggerExtraForm({ form, index }: TriggerFormProps) {
  const { t, language } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const server = useServerStore((state) => state.server);
  const [advancedManual, setAdvancedManual] = useState(false);

  const trigger = form.values.triggers[index];
  const schedule = trigger.type === 'cron' ? trigger.schedule : '';
  const simple = useMemo(() => parseSimpleSchedule(schedule), [schedule]);

  const weekdayOptions = useMemo(() => getLocalizedCronWeekdays(language), [language]);

  if (trigger.type !== 'cron') return null;

  const advanced = advancedManual || !simple;

  const setSchedule = (value: string) => form.setFieldValue(`triggers.${index}.schedule`, value);
  const setSimple = (value: SimpleSchedule) => setSchedule(simpleScheduleToCron(value));
  const setWeekAnchor = (value: string | null) => form.setFieldValue(`triggers.${index}.weekAnchor`, value);

  const setWeekInterval = (value: number) => {
    const weekInterval = Math.min(Math.max(Math.floor(value) || 1, 1), 52);
    form.setFieldValue(`triggers.${index}.weekInterval`, weekInterval);

    if (weekInterval > 1 && !trigger.weekAnchor) {
      setWeekAnchor(new Intl.DateTimeFormat('en-CA', { timeZone: server.timezone || 'UTC' }).format(new Date()));
    }
  };

  const handleFrequencyChange = (frequency: string) => {
    const hour = simple && 'hour' in simple ? simple.hour : 0;
    const minute = simple && 'minute' in simple ? simple.minute : 0;
    if (frequency !== 'weekly') setWeekInterval(1);

    switch (frequency) {
      case 'everyMinutes':
        setSimple({ frequency, interval: 30 });
        break;
      case 'everyHours':
        setSimple({ frequency, interval: 6 });
        break;
      case 'daily':
        setSimple({ frequency, hour, minute });
        break;
      case 'weekly':
        setSimple({ frequency, weekday: 'SUN', hour, minute });
        break;
      case 'monthly':
        setSimple({ frequency, day: 1, hour, minute });
        break;
    }
  };

  const handleTimeChange = (value: string) => {
    if (!simple || !('hour' in simple)) return;

    const [hour, minute] = value.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;

    setSimple({ ...simple, hour, minute });
  };

  const cronValid = isValidCronExpression(schedule);
  const description = cronValid ? describeCronPlain(schedule, trigger.weekInterval, language) : null;

  const timeValue =
    simple && 'hour' in simple
      ? `${String(simple.hour).padStart(2, '0')}:${String(simple.minute).padStart(2, '0')}`
      : '00:00';

  return (
    <Stack gap='xs'>
      {advanced ? (
        <Popover>
          <Popover.Target>
            <TextInput
              withAsterisk
              label={t('pages.server.schedules.triggers.cron.form.cronSchedule', {})}
              {...form.getInputProps(`triggers.${index}.schedule`)}
              error={cronValid ? undefined : t('pages.server.schedules.triggers.cron.invalidCron', {})}
            />
          </Popover.Target>
          <Popover.Dropdown>
            <CrontabEditor value={schedule} setValue={setSchedule} />
          </Popover.Dropdown>
        </Popover>
      ) : (
        <Group align='end' gap='sm'>
          <div className='taxz-cronfreq'>
            <span className='taxz-cronfreq-label' id={`taxz-freq-${index}`}>
              {tExt('schedule.form.repeat', {})}
            </span>
            <div className='taxz-seg2' role='group' aria-labelledby={`taxz-freq-${index}`}>
              {FREQUENCIES.map((value) => (
                <button
                  key={value}
                  type='button'
                  aria-pressed={simple!.frequency === value}
                  className={simple!.frequency === value ? 'is-on' : undefined}
                  onClick={() => handleFrequencyChange(value)}
                >
                  {tExt(`schedule.form.frequency.${value}`, {})}
                </button>
              ))}
            </div>
          </div>

          {simple!.frequency === 'everyMinutes' && (
            <NumberInput
              label={t('pages.server.schedules.triggers.cron.form.intervalMinutes', {})}
              className='w-40'
              min={1}
              max={59}
              value={simple!.interval}
              onChange={(value) => setSimple({ frequency: 'everyMinutes', interval: Number(value) || 1 })}
            />
          )}
          {simple!.frequency === 'everyHours' && (
            <NumberInput
              label={t('pages.server.schedules.triggers.cron.form.intervalHours', {})}
              className='w-40'
              min={1}
              max={23}
              value={simple!.interval}
              onChange={(value) => setSimple({ frequency: 'everyHours', interval: Number(value) || 1 })}
            />
          )}
          {simple!.frequency === 'weekly' && (
            <Select
              label={t('pages.server.schedules.triggers.cron.form.weekday', {})}
              className='w-40'
              value={simple!.weekday}
              onChange={(value) =>
                value &&
                simple!.frequency === 'weekly' &&
                setSimple({ ...simple!, weekday: value as (typeof CRON_WEEKDAYS)[number] })
              }
              data={weekdayOptions}
            />
          )}
          {simple!.frequency === 'monthly' && (
            <NumberInput
              label={t('pages.server.schedules.triggers.cron.form.dayOfMonth', {})}
              className='w-40'
              min={1}
              max={31}
              value={simple!.day}
              onChange={(value) =>
                simple!.frequency === 'monthly' &&
                setSimple({ ...simple!, day: Math.min(Math.max(Number(value) || 1, 1), 31) })
              }
            />
          )}
          {(simple!.frequency === 'daily' || simple!.frequency === 'weekly' || simple!.frequency === 'monthly') && (
            <TimeInput
              label={t('pages.server.schedules.triggers.cron.form.time', {})}
              className='w-40'
              value={timeValue}
              onChange={(e) => handleTimeChange(e.currentTarget.value)}
            />
          )}
        </Group>
      )}

      {(advanced || simple!.frequency === 'weekly') && (
        <Group align='end' gap='sm'>
          <NumberInput
            label={t('pages.server.schedules.triggers.cron.form.weekInterval', {})}
            className='w-40'
            min={1}
            max={52}
            value={trigger.weekInterval}
            onChange={(value) => setWeekInterval(Number(value))}
          />
          {trigger.weekInterval > 1 && (
            <Popover>
              <Popover.Target>
                <TextInput
                  readOnly
                  className='w-60'
                  label={t('pages.server.schedules.triggers.cron.form.weekAnchor', {})}
                  value={trigger.weekAnchor ?? ''}
                />
              </Popover.Target>
              <Popover.Dropdown>
                <DatePicker
                  value={trigger.weekAnchor}
                  defaultDate={trigger.weekAnchor ?? undefined}
                  onChange={(value) => value && setWeekAnchor(value)}
                />
              </Popover.Dropdown>
            </Popover>
          )}
        </Group>
      )}

      <div className='taxz-cronsum' aria-live='polite'>
        {description && <b>{description}</b>}
        <span>
          Zeitzone {server.timezone || 'UTC'} · Cron <code>{schedule}</code>
        </span>
      </div>

      <Switch
        label={t('pages.server.schedules.triggers.cron.form.advanced', {})}
        checked={advanced}
        onChange={(e) => {
          const enabled = e.currentTarget.checked;
          setAdvancedManual(enabled);
          if (!enabled && !simple) {
            setSchedule('0 0 0 * * *');
          }
        }}
      />
    </Stack>
  );
}

const FREQUENCIES: SimpleSchedule['frequency'][] = ['daily', 'weekly', 'everyHours', 'monthly', 'everyMinutes'];

export default function CronTriggerExtraForm(props: TriggerFormProps) {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzCronTriggerExtraForm {...props} /> : <OriginalCronTriggerExtraForm {...props} />;
}
