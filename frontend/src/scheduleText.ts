// Zeitplaene in Klartext (Designvorgabe 9.13, Idee 17): jeder Ausloeser als deutscher Satz ("Jeden Tag um 04:30"),
// dazu der naechste Lauf. Einfache Cron-Formen beschreibt das Theme selbst, alles andere uebernimmt die Beschreibung des
// Panels (cronstrue). Andere Ausloeser des Panels (Ein/Aus, Status, Backup, Absturz, ...) werden ebenfalls als Satz beschrieben.

import type { z } from 'zod';
import { CRON_WEEKDAYS, describeCron, getCronOccurrence, parseSimpleSchedule } from '@/lib/cron.ts';
import type { serverScheduleTriggerSchema } from '@/lib/schemas/server/schedules.ts';

type Trigger = z.infer<typeof serverScheduleTriggerSchema>;

const WEEKDAY_NAMES: Record<(typeof CRON_WEEKDAYS)[number], string> = {
  SUN: 'Sonntag',
  MON: 'Montag',
  TUE: 'Dienstag',
  WED: 'Mittwoch',
  THU: 'Donnerstag',
  FRI: 'Freitag',
  SAT: 'Samstag',
};

const POWER_ACTION: Record<string, string> = {
  start: 'gestartet',
  stop: 'gestoppt',
  restart: 'neu gestartet',
  kill: 'hart beendet',
};

const POWER_STATE: Record<string, string> = {
  running: '„Läuft“',
  offline: '„Gestoppt“',
  starting: '„Startet“',
  stopping: '„Stoppt“',
};

const BACKUP_STATUS: Record<string, string> = {
  starting: 'startet',
  finished: 'fertig ist',
  failed: 'fehlschlägt',
};

const METRIC: Record<string, string> = { cpu: 'die CPU-Last', memory: 'der RAM', disk: 'der Speicher' };

const COMPARATOR: Record<string, string> = {
  smaller_than: 'unter',
  smaller_than_or_equals: 'höchstens bei',
  equal: 'genau bei',
  greater_than: 'über',
  greater_than_or_equals: 'mindestens bei',
};

const pad = (n: number) => String(n).padStart(2, '0');
const time = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

function weeks(interval: number) {
  return interval > 1 ? `alle ${interval} Wochen ` : 'jeden ';
}

export function describeCronGerman(schedule: string, weekInterval: number, language: string): string {
  const simple = parseSimpleSchedule(schedule);
  if (simple) {
    switch (simple.frequency) {
      case 'everyMinutes':
        return simple.interval === 1 ? 'Jede Minute' : `Alle ${simple.interval} Minuten`;
      case 'everyHours':
        return simple.interval === 1 ? 'Jede Stunde zur vollen Stunde' : `Alle ${simple.interval} Stunden`;
      case 'daily':
        return `Jeden Tag um ${time(simple.hour, simple.minute)}`;
      case 'weekly': {
        const text = `${weeks(weekInterval)}${WEEKDAY_NAMES[simple.weekday]} um ${time(simple.hour, simple.minute)}`;
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
      case 'monthly':
        return `Jeden Monat am ${simple.day}. um ${time(simple.hour, simple.minute)}`;
    }
  }
  try {
    return describeCron(schedule, weekInterval, language);
  } catch {
    return `Zeitplan ${schedule}`;
  }
}

export function describeTrigger(trigger: Trigger, language: string): string {
  switch (trigger.type) {
    case 'cron':
      return describeCronGerman(trigger.schedule, trigger.weekInterval, language);
    case 'power_action':
      return `Wenn der Server ${POWER_ACTION[trigger.action] ?? trigger.action} wird`;
    case 'server_state':
      return `Wenn der Server ${POWER_STATE[trigger.state] ?? trigger.state} meldet`;
    case 'backup_status':
      return `Wenn ein Backup ${BACKUP_STATUS[trigger.status] ?? trigger.status}`;
    case 'database_backup_status':
      return `Wenn ein Datenbank-Backup ${BACKUP_STATUS[trigger.status] ?? trigger.status}`;
    case 'schedule_completion':
      return trigger.successful
        ? 'Wenn ein anderer Zeitplan erfolgreich durchgelaufen ist'
        : 'Wenn ein anderer Zeitplan fehlgeschlagen ist';
    case 'resource_usage': {
      const value = trigger.percentage ? `${trigger.value} %` : `${trigger.value}`;
      const span = trigger.forSeconds > 0 ? ` für ${trigger.forSeconds} s` : '';
      return `Wenn ${METRIC[trigger.metric] ?? trigger.metric}${span} ${COMPARATOR[trigger.comparator] ?? ''} ${value} liegt`;
    }
    case 'console_line':
      return `Wenn in der Konsole „${trigger.contains}“ erscheint`;
    case 'crash':
      return 'Wenn der Server abstürzt';
    default:
      return 'Eigener Auslöser';
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

/** "heute 04:30", "morgen 04:30" oder "Mo., 24.11., 03:00" in der Zeitzone des Servers. */
export function formatNext(date: Date, timezone: string, now = new Date()): string {
  const day = new Intl.DateTimeFormat('de-DE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const clock = new Intl.DateTimeFormat('de-DE', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(date);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (day.format(date) === day.format(now)) return `heute ${clock}`;
  if (day.format(date) === day.format(tomorrow)) return `morgen ${clock}`;
  const label = new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
  return `${label}, ${clock}`;
}
