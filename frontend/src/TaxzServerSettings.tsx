// Server-Einstellungen im taxz-Theme (Designvorgabe 7.5): Abschnitte als Karten, eine gemeinsame Speichern-Leiste statt
// eines Knopfs pro Karte, "Neu installieren" in einer eigenen Karte "Gefahrenbereich". Gespeichert wird ueber dieselben
// Schnittstellen und Pruefregeln wie im Standard-Panel, jeder Abschnitt nur mit seinem Recht. Mit "Standard" das Original.

import { faArrowsRotate, faCopy, faMicrochip, faPen, faPowerOff, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { type ReactNode, useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import renameServer from '@/api/server/settings/renameServer.ts';
import updateAutokill from '@/api/server/settings/updateAutokill.ts';
import updateAutostart from '@/api/server/settings/updateAutostart.ts';
import updateTimezone from '@/api/server/settings/updateTimezone.ts';
import updateTrash from '@/api/server/settings/updateTrash.ts';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TimezoneInput from '@/elements/input/TimezoneInput.tsx';
import TrashSettingsInput from '@/elements/input/TrashSettingsInput.tsx';
import { formatDateTimeAsTimezone } from '@/lib/format/time.ts';
import {
  serverSettingsAutokillSchema,
  serverSettingsAutostartSchema,
  serverSettingsRenameSchema,
  serverSettingsTimezoneSchema,
  serverSettingsTrashSchema,
} from '@/lib/schemas/server/settings.ts';
import SettingsReinstallModal from '@/pages/server/settings/modals/SettingsReinstallModal.tsx';
import OriginalServerSettings from '@/pages/server/settings/ServerSettings.tsx';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';
import SaveBar from './SaveBar.tsx';
import ServerImageSection from './ServerImageSection.tsx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = UseFormReturnType<any>;

export function Section({
  icon,
  title,
  subtitle,
  danger = false,
  children,
}: {
  icon: typeof faPen;
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={danger ? 'taxz-sect taxz-sect-danger' : 'taxz-sect'}>
      <h2 className='taxz-sect-title'>
        <FontAwesomeIcon icon={icon} aria-hidden='true' />
        {title}
      </h2>
      {subtitle && <p className='taxz-sect-sub'>{subtitle}</p>}
      <div className='taxz-sect-body'>{children}</div>
    </section>
  );
}

function changedFields(form: AnyForm, keys: string[]) {
  return keys.filter((key) => form.isDirty(key)).length;
}

function commit(form: AnyForm) {
  form.setInitialValues(form.values);
  form.resetDirty(form.values);
}

function TechInfo() {
  const server = useServerStore((state) => state.server);
  const rows = [
    { label: 'Node', value: `${server.nodeName} · ${server.nodeUuid}` },
    { label: 'Standort', value: `${server.locationName} · ${server.locationUuid}` },
    { label: 'Server-UUID', value: server.uuid },
  ];
  return (
    <Section icon={faMicrochip} title='Technische Angaben' subtitle='Nur für Fehlersuche und Support'>
      <dl className='taxz-kv'>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              <span className='taxz-mono'>{row.value}</span>
              <CopyOnClick content={row.value} className='taxz-ib'>
                <span className='taxz-sr'>{row.label} kopieren</span>
                <FontAwesomeIcon icon={faCopy} aria-hidden='true' />
              </CopyOnClick>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function DangerZone() {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Section icon={faArrowsRotate} title='Gefahrenbereich' danger>
      <SettingsReinstallModal opened={open} onClose={() => setOpen(false)} />
      <h3 className='taxz-danger-h'>{t('pages.server.settings.reinstall.title', {})}</h3>
      <div className='taxz-danger-text'>{t('pages.server.settings.reinstall.content', {}).md()}</div>
      <div>
        <button type='button' className='taxz-btn taxz-btn-danger-solid' onClick={() => setOpen(true)}>
          <FontAwesomeIcon icon={faArrowsRotate} aria-hidden='true' />
          {t('pages.server.settings.reinstall.button', {})} …
        </button>
      </div>
    </Section>
  );
}

function TaxzServerSettings() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const updateServer = useServerStore((state) => state.updateServer);
  const allowTrash = useGlobalStore((state) => state.settings.server.allowChangingTrashSettings);

  const canRename = useServerCan('settings.rename');
  const canTimezone = useServerCan('settings.timezone');
  const canAutostart = useServerCan('settings.auto-start');
  const canAutokill = useServerCan('settings.auto-kill');
  const canTrash = useServerCan('settings.trash') && allowTrash;
  const canInstall = useServerCan('settings.install');

  const rename = useForm<z.infer<typeof serverSettingsRenameSchema>>({
    initialValues: { name: server.name, description: server.description ?? '' },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsRenameSchema),
  });
  const timezone = useForm<z.infer<typeof serverSettingsTimezoneSchema>>({
    initialValues: { timezone: server.timezone ?? null },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsTimezoneSchema),
  });
  const autostart = useForm<z.infer<typeof serverSettingsAutostartSchema>>({
    initialValues: { behavior: server.autoStartBehavior },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsAutostartSchema),
  });
  const autokill = useForm<z.infer<typeof serverSettingsAutokillSchema>>({
    initialValues: { enabled: server.autoKill.enabled, seconds: server.autoKill.seconds },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsAutokillSchema),
  });
  const trash = useForm<z.infer<typeof serverSettingsTrashSchema>>({
    initialValues: {
      custom: server.trash.custom
        ? { retention: server.trash.retention ?? 0, usageThreshold: server.trash.usageThreshold ?? 0 }
        : null,
    },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsTrashSchema),
  });

  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const zone = timezone.values.timezone;
    if (!zone) {
      setNow(null);
      return;
    }
    setNow(formatDateTimeAsTimezone(new Date(), zone, true));
    const timer = setInterval(() => setNow(formatDateTimeAsTimezone(new Date(), zone, true)), 1000);
    return () => clearInterval(timer);
  }, [timezone.values.timezone]);

  const parts = [
    { on: canRename, form: rename as AnyForm, keys: ['name', 'description'] },
    { on: canTimezone, form: timezone as AnyForm, keys: ['timezone'] },
    { on: canAutostart, form: autostart as AnyForm, keys: ['behavior'] },
    { on: canAutokill, form: autokill as AnyForm, keys: ['enabled', 'seconds'] },
    { on: canTrash, form: trash as AnyForm, keys: ['custom'] },
  ].filter((part) => part.on);

  const count = parts.reduce((sum, part) => sum + changedFields(part.form, part.keys), 0);
  const dirtyParts = parts.filter((part) => changedFields(part.form, part.keys) > 0);
  const canSave = dirtyParts.every((part) => part.form.isValid());

  const discard = () => parts.forEach((part) => part.form.reset());

  const save = async () => {
    for (const part of dirtyParts) {
      if (part.form.validate().hasErrors) return;
    }
    setSaving(true);
    const errors: string[] = [];
    const run = async (form: AnyForm, action: () => Promise<unknown>, after: () => void) => {
      if (!dirtyParts.some((part) => part.form === form)) return;
      try {
        await action();
        after();
        commit(form);
      } catch (error) {
        errors.push(httpErrorToHuman(error));
      }
    };

    await run(
      rename,
      () => renameServer(server.uuid, serverSettingsRenameSchema.parse(rename.values)),
      () => updateServer(rename.values),
    );
    await run(
      timezone,
      () => updateTimezone(server.uuid, timezone.values),
      () => updateServer({ timezone: timezone.values.timezone }),
    );
    await run(
      autostart,
      () => updateAutostart(server.uuid, autostart.values),
      () => updateServer({ autoStartBehavior: autostart.values.behavior }),
    );
    await run(
      autokill,
      () => updateAutokill(server.uuid, autokill.values),
      () => updateServer({ autoKill: autokill.values }),
    );
    await run(
      trash,
      () => updateTrash(server.uuid, trash.values),
      () => {
        const effective = trash.values.custom ?? server.trash.defaults;
        updateServer({
          trash: {
            ...server.trash,
            custom: trash.values.custom !== null,
            retention: effective.retention === 0 ? null : effective.retention,
            usageThreshold: effective.usageThreshold === 0 ? null : effective.usageThreshold,
          },
        });
      },
    );

    setSaving(false);
    if (errors.length) errors.forEach((message) => addToast(message, 'error'));
    else addToast('Einstellungen gespeichert.', 'success');
  };

  return (
    <ServerContentContainer
      title='Einstellungen'
      subtitle={`${server.name} · Änderungen werden gemeinsam gespeichert`}
      registry={window.extensionContext.extensionRegistry.pages.server.settings.container}
    >
      <form
        className='taxz-settings'
        onSubmit={(event) => {
          event.preventDefault();
          if (count > 0 && canSave) save();
        }}
      >
        <div className='taxz-settings-main'>
          {(canRename || canTimezone) && (
            <Section icon={faPen} title='Allgemein'>
              {canRename && (
                <>
                  <TextInput withAsterisk label={t('common.form.serverName', {})} {...rename.getInputProps('name')} />
                  <TextArea label={t('common.form.description', {})} rows={3} {...rename.getInputProps('description')} />
                </>
              )}
              {canTimezone && (
                <div>
                  <TimezoneInput
                    label={t('pages.server.settings.timezone.title', {})}
                    placeholder={t('common.form.timezoneSystem', {})}
                    allowDeselect
                    clearable
                    {...timezone.getInputProps('timezone')}
                  />
                  {now && <p className='taxz-hint'>Uhrzeit dort: {now}</p>}
                </div>
              )}
            </Section>
          )}

          {(canAutostart || canAutokill) && (
            <Section icon={faPowerOff} title='Verhalten'>
              {canAutostart && (
                <Select
                  withAsterisk
                  label={t('pages.server.settings.autostart.title', {})}
                  description='Nach einem Neustart des Systems'
                  data={[
                    { label: t('common.enum.serverAutoStartBehavior.always', {}), value: 'always' },
                    { label: t('common.enum.serverAutoStartBehavior.unlessStopped', {}), value: 'unless_stopped' },
                    { label: t('common.enum.serverAutoStartBehavior.never', {}), value: 'never' },
                  ]}
                  {...autostart.getInputProps('behavior')}
                />
              )}
              {canAutokill && (
                <>
                  <Switch
                    label={t('pages.server.settings.autokill.title', {})}
                    description='Hängenden Server nach dem Stoppen hart beenden'
                    {...autokill.getInputProps('enabled', { type: 'checkbox' })}
                  />
                  <NumberInput
                    label={t('pages.server.settings.autokill.form.secondsUntilAutoKill', {})}
                    className='taxz-narrow'
                    {...autokill.getInputProps('seconds')}
                  />
                </>
              )}
            </Section>
          )}

          {canTrash && (
            <Section icon={faTrashCan} title={t('pages.server.settings.trash.title', {})}>
              <TrashSettingsInput
                value={trash.values.custom}
                defaults={server.trash.defaults}
                onChange={(custom) => trash.setFieldValue('custom', custom)}
                errors={{
                  retention: trash.errors['custom.retention'],
                  usageThreshold: trash.errors['custom.usageThreshold'],
                }}
              />
            </Section>
          )}

          <div className='taxz-settings-ext'>
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.server.settings.settingContainers.prependedComponents
              }
              name='settings-settingContainer-prepended'
            />
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.server.settings.settingContainers.appendedComponents
              }
              name='settings-settingContainer-appended'
            />
          </div>
        </div>

        <aside className='taxz-settings-side'>
          {canRename && <ServerImageSection />}
          <TechInfo />
          {canInstall && <DangerZone />}
        </aside>

        <SaveBar count={count} saving={saving} canSave={canSave} onDiscard={discard} onSave={save} />
      </form>
    </ServerContentContainer>
  );
}

export default function ServerSettings() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzServerSettings /> : <OriginalServerSettings />;
}
