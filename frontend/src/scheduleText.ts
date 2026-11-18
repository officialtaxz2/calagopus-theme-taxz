// Zeitplaene in Klartext (Designvorgabe 9.13, Idee 17): jeder Ausloeser als Satz ("Jeden Tag um 04:30", "Every day at 04:30"),
// dazu der naechste Lauf. Einfache Cron-Formen beschreibt das Theme selbst, alles andere uebernimmt die Beschreibung des
// Panels (cronstrue). Andere Ausloeser des Panels (Ein/Aus, Status, Backup, Absturz, ...) werden ebenfalls als Satz beschrieben.

import type { z } from 'zod';
import { CRON_WEEKDAYS, describeCron, getCronOccurrence, parseSimpleSchedule } from '@/lib/cron.ts';
import type { serverScheduleTriggerSchema } from '@/lib/schemas/server/schedules.ts';
import { getExtTranslations } from './translations.ts';

type Trigger = z.infer<typeof serverScheduleTriggerSchema>;

const WEEKDAYS: Record<(typeof CRON_WEEKDAYS)[number], 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> = {
  SUN: 'sun',
  MON: 'mon',
  TUE: 'tue',
  WED: 'wed',
  THU: 'thu',
  FRI: 'fri',
  SAT: 'sat',
};

const POWER_ACTIONS = ['start', 'stop', 'restart', 'kill'] as const;
const POWER_STATES = ['running', 'offline', 'starting', 'stopping'] as const;
const BACKUP_STATUSES = ['starting', 'finished', 'failed'] as const;
const METRICS = ['cpu', 'memory', 'disk'] as const;
const COMPARATORS = ['smaller_than', 'smaller_than_or_equals', 'equal', 'greater_than', 'greater_than_or_equals'] as const;

const has = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

const pad = (n: number) => String(n).padStart(2, '0');
const time = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

/** Einfache Cron-Formen als Satz in der Sprache des Benutzers, alles andere beschreibt das Panel (cronstrue). */
export function describeCronPlain(schedule: string, weekInterval: number, language: string): string {
  const { t } = getExtTranslations();
  const simple = parseSimpleSchedule(schedule);
  if (simple) {
    switch (simple.frequency) {
      case 'everyMinutes':
        return simple.interval === 1 ? t('schedule.cron.everyMinute', {}) : t('schedule.cron.everyMinutes', { n: simple.interval });
      case 'everyHours':
        return simple.interval === 1 ? t('schedule.cron.everyHour', {}) : t('schedule.cron.everyHours', { n: simple.interval });
      case 'daily':
        return t('schedule.cron.daily', { time: time(simple.hour, simple.minute) });
      case 'weekly': {
        const weekday = t(`schedule.weekday.${WEEKDAYS[simple.weekday]}`, {});
        const at = time(simple.hour, simple.minute);
        return weekInterval > 1
          ? t('schedule.cron.everyWeeks', { n: weekInterval, weekday, time: at })
          : t('schedule.cron.weekly', { weekday, time: at });
      }
      case 'monthly':
        return t('schedule.cron.monthly', { day: simple.day, time: time(simple.hour, simple.minute) });
    }
  }
  try {
    return describeCron(schedule, weekInterval, language);
  } catch {
    return t('schedule.cron.raw', { schedule });
  }
}

export function describeTrigger(trigger: Trigger, language: string): string {
  const { t } = getExtTranslations();
  switch (trigger.type) {
    case 'cron':
      return describeCronPlain(trigger.schedule, trigger.weekInterval, language);
    case 'power_action':
      return has(POWER_ACTIONS, trigger.action)
        ? t(`schedule.trigger.power.${trigger.action}`, {})
        : t('schedule.trigger.powerOther', { action: trigger.action });
    case 'server_state':
      return has(POWER_STATES, trigger.state)
        ? t(`schedule.trigger.state.${trigger.state}`, {})
        : t('schedule.trigger.stateOther', { state: trigger.state });
    case 'backup_status':
      return has(BACKUP_STATUSES, trigger.status)
        ? t(`schedule.trigger.backup.${trigger.status}`, {})
        : t('schedule.trigger.backupOther', { status: trigger.status });
    case 'database_backup_status':
      return has(BACKUP_STATUSES, trigger.status)
        ? t(`schedule.trigger.databaseBackup.${trigger.status}`, {})
        : t('schedule.trigger.databaseBackupOther', { status: trigger.status });
    case 'schedule_completion':
      return trigger.successful ? t('schedule.trigger.scheduleOk', {}) : t('schedule.trigger.scheduleFailed', {});
    case 'resource_usage': {
      const metric = has(METRICS, trigger.metric) ? t(`schedule.metric.${trigger.metric}`, {}) : trigger.metric;
      const comparator = has(COMPARATORS, trigger.comparator) ? t(`schedule.comparator.${trigger.comparator}`, {}) : '';
      const value = trigger.percentage ? `${trigger.value} %` : `${trigger.value}`;
      return trigger.forSeconds > 0
        ? t('schedule.trigger.resourceFor', { metric, comparator, value, seconds: trigger.forSeconds })
        : t('schedule.trigger.resource', { metric, comparator, value });
    }
    case 'console_line':
      return t('schedule.trigger.console', { text: trigger.contains });
    case 'crash':
      return t('schedule.trigger.crash', {});
    default:
      return t('schedule.trigger.other', {});
  }
}

/** Naechster Lauf ueber alle Cron-Ausloeser, oder null wenn keiner zeitgesteuert ist. */
export function nextRun(triggers: Trigger[], timezone: string, from = new Date()): Date | null {
  let next: Date | null = null;
  for (const trigger of triggers) {
    if (trigger.type !== 'cron') continue;
    try {
      const date = getCronOccurrence(trigger.schedule, timezone, from, 'next', trigger.weekInterval, trigger.weekAnchor);
      if (!next || date < next) next = date;
    } catch {
      // Ungueltiger Ausdruck: ohne naechsten Lauf
    }
  }
  return next;
}

/** "heute 04:30", "morgen 04:30" oder "Mo., 24.11., 03:00" in der Zeitzone des Servers und der Sprache des Benutzers. */
export function formatNext(date: Date, timezone: string, now = new Date()): string {
  const { t, language } = getExtTranslations();
  const lang = language || 'en';
  const day = new Intl.DateTimeFormat(lang, { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const clock = new Intl.DateTimeFormat(lang, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(date);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (day.format(date) === day.format(now)) return t('schedule.next.today', { time: clock });
  if (day.format(date) === day.format(tomorrow)) return t('schedule.next.tomorrow', { time: clock });
  const label = new Intl.DateTimeFormat(lang, {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
  return t('schedule.next.date', { date: label, time: clock });
}
