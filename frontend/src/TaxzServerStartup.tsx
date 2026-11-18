// Seite "Start" im taxz-Theme (Designvorgabe 7.5 und 9.12, Idee 16): Startbefehl und Docker-Image als Karten wie im
// Standard-Panel (dort wird beim Aendern sofort gespeichert), die Variablen des Eggs als ein Formular mit einem
// Steuerelement je Regel (variableControl.ts) und der gemeinsamen Speichern-Leiste. Gespeichert wird ueber dieselben
// Schnittstellen und Pruefungen wie im Standard-Panel. Mit "Standard" das Original.

import { faDocker } from '@fortawesome/free-brands-svg-icons';
import { faPlay, faReply, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Slider } from '@mantine/core';
import classNames from 'classnames';
import debounce from 'debounce';
import { useEffect, useId, useMemo, useState } from 'react';
import type { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getVariables from '@/api/server/startup/getVariables.ts';
import updateCommand from '@/api/server/startup/updateCommand.ts';
import updateDockerImage from '@/api/server/startup/updateDockerImage.ts';
import updateVariables from '@/api/server/startup/updateVariables.ts';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import type { serverVariableSchema } from '@/lib/schemas/server/startup.ts';
import OriginalServerStartup from '@/pages/server/startup/ServerStartup.tsx';
import { useKeyboardShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { trackActivity } from '@/stores/activity.ts';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import { useIsTaxz } from './prefs.ts';
import SaveBar from './SaveBar.tsx';
import { Section } from './TaxzServerSettings.tsx';
import { variableControl } from './variableControl.ts';

type Variable = z.infer<typeof serverVariableSchema>;

const CUSTOM_COMMAND = '__custom__';

function VariableRow({
  variable,
  value,
  changed,
  disabled,
  error,
  onChange,
}: {
  variable: Variable;
  value: string;
  changed: boolean;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const { t, language } = useTranslations();
  const id = useId();
  const labelId = `${id}-label`;
  const descId = `${id}-desc`;
  const errId = `${id}-err`;
  const control = useMemo(() => variableControl(variable), [variable]);
  const readOnly = !variable.isEditable;
  const off = disabled || readOnly;
  const required = variable.rules.includes('required');
  const title = variable.nameTranslations?.[language] || variable.name;
  const description = variable.descriptionTranslations?.[language] || variable.description;
  const described = [description ? descId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const a11y = { 'aria-labelledby': labelId, 'aria-describedby': described };

  let input: React.ReactNode;
  switch (control.type) {
    case 'switch':
      input = (
        <Switch
          checked={value === control.on || value.toLowerCase() === 'true'}
          onChange={(event) => onChange(event.currentTarget.checked ? control.on : control.off)}
          disabled={off}
          {...a11y}
        />
      );
      break;
    case 'segment':
      input = (
        <div className='taxz-seg2' role='radiogroup' {...a11y}>
          {control.options.map((option) => (
            <button
              key={option}
              type='button'
              role='radio'
              aria-checked={value === option}
              className={value === option ? 'is-on' : undefined}
              disabled={off}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      );
      break;
    case 'select':
      input = (
        <Select
          data={control.options.map((option) => ({ value: option, label: option }))}
          value={value}
          onChange={(next) => onChange(next ?? '')}
          disabled={off}
          searchable={control.options.length > 8}
          error={!!error}
          {...a11y}
        />
      );
      break;
    case 'range': {
      const current = Number(value);
      const inRange = Number.isFinite(current) && value.trim() !== '';
      input = (
        <div className='taxz-vrange'>
          <Slider
            min={control.min}
            max={control.max}
            step={control.step}
            value={inRange ? Math.min(control.max, Math.max(control.min, current)) : control.min}
            onChange={(next) => onChange(String(next))}
            disabled={off}
            label={null}
            thumbProps={{ 'aria-labelledby': labelId, 'aria-describedby': described }}
          />
          <NumberInput
            value={value}
            onChange={(next) => onChange(String(next))}
            min={control.min}
            max={control.max}
            step={control.step}
            disabled={off}
            error={!!error}
            hideControls
            {...a11y}
          />
        </div>
      );
      break;
    }
    case 'number':
      input = (
        <NumberInput
          value={value}
          onChange={(next) => onChange(String(next))}
          min={control.min}
          max={control.max}
          allowDecimal={!control.integer}
          placeholder={variable.defaultValue ?? ''}
          disabled={off}
          error={!!error}
          {...a11y}
        />
      );
      break;
    case 'secret':
      input = (
        <PasswordInput
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={variable.defaultValue ?? ''}
          disabled={off}
          error={!!error}
          {...a11y}
        />
      );
      break;
    default:
      input = (
        <TextInput
          {...ignorePasswordManagerProps}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={variable.defaultValue ?? ''}
          disabled={off}
          error={!!error}
          rightSection={
            variable.defaultValue && !off && value !== variable.defaultValue ? (
              <button
                type='button'
                className='taxz-ib taxz-vreset'
                onClick={() => onChange(variable.defaultValue ?? '')}
                title={t('common.tooltip.resetToDefault', {})}
                aria-label={`${title}: ${t('common.tooltip.resetToDefault', {})}`}
              >
                <FontAwesomeIcon icon={faReply} />
              </button>
            ) : undefined
          }
          {...a11y}
        />
      );
  }

  return (
    <div className={classNames('taxz-vrow', `is-${control.type}`, changed && 'is-changed')}>
      <div className='taxz-vlabel'>
        <span id={labelId} className='taxz-vname'>
          {title}
          {required && !readOnly && (
            <span className='taxz-vreq' aria-hidden='true'>
              {' '}
              *
            </span>
          )}
          {readOnly && <span className='taxz-vbadge'>{t('common.readOnly', {})}</span>}
        </span>
        {description && (
          <div id={descId} className='taxz-vdesc'>
            {description.md()}
          </div>
        )}
        <code className='taxz-venv'>{variable.envVariable}</code>
      </div>
      <div className='taxz-vctl'>
        {input}
        {error && (
          <p id={errId} className='taxz-verr' role='alert'>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function TaxzServerStartup() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const settings = useGlobalStore((state) => state.settings);
  const { server, updateServer, variables, setVariables, updateVariable } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      updateServer: state.updateServer,
      variables: state.variables,
      setVariables: state.setVariables,
      updateVariable: state.updateVariable,
    })),
  );
  const serverStoreApi = useServerStoreApi();
  const canModifyVariables = useServerCan('startup.update');
  const canModifyStartupCommand = useServerCan('startup.command');
  const canModifyDockerImage = useServerCan('startup.docker-image');

  const [command, setCommand] = useState(server.startup);
  const [customCommandSelected, setCustomCommandSelected] = useState(false);
  const [dockerImage, setDockerImage] = useState(server.image);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [variablesLoading, setVariablesLoading] = useState(true);
  const [variablesError, setVariablesError] = useState<unknown>(null);
  const [variableErrors, setVariableErrors] = useState<Record<string, string>>({});
  const count = Object.keys(values).length;
  const blocker = useBlocker(count > 0);

  const setDebouncedCommand = useMemo(
    () =>
      debounce((next: string, revertOnError: boolean) => {
        updateCommand(server.uuid, next)
          .then(() => {
            addToast(t('pages.server.startup.toast.startupCommandUpdated', {}), 'success');
            updateServer({ startup: next });
          })
          .catch((msg) => {
            addToast(httpErrorToHuman(msg), 'error');
            if (revertOnError) setCommand(serverStoreApi.getState().server.startup);
          });
      }, 500),
    [server.uuid, t, addToast, updateServer],
  );

  const loadVariables = () => {
    setVariablesLoading(true);
    setVariablesError(null);
    trackActivity(getVariables(server.uuid))
      .then(setVariables)
      .catch(setVariablesError)
      .finally(() => setVariablesLoading(false));
  };

  useEffect(loadVariables, []);

  const isPredefinedCommand = (value: string) => Object.values(server.egg.startupCommands).includes(value);

  useEffect(() => {
    if (command !== server.startup) setDebouncedCommand(command, isPredefinedCommand(command));
  }, [command]);

  useEffect(() => {
    if (dockerImage !== server.image) {
      updateDockerImage(server.uuid, dockerImage)
        .then(() => {
          addToast(t('pages.server.startup.toast.dockerImageUpdated', {}), 'success');
          updateServer({ image: dockerImage });
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
          setDockerImage(server.image);
        });
    }
  }, [dockerImage]);

  const currentValue = (variable: Variable) => variable.value ?? variable.defaultValue ?? '';

  const setValue = (variable: Variable, value: string) => {
    setValues((prev) => {
      const next = { ...prev };
      // Zurueck auf den gespeicherten Wert zaehlt nicht als Aenderung.
      if (value === currentValue(variable)) delete next[variable.envVariable];
      else next[variable.envVariable] = value;
      return next;
    });
    setVariableErrors((prev) => {
      const next = { ...prev };
      delete next[variable.envVariable];
      return next;
    });
  };

  const discard = () => {
    setValues({});
    setVariableErrors({});
  };

  const save = () => {
    const missing: Record<string, string> = {};
    for (const variable of variables) {
      if (
        variable.envVariable in values &&
        variable.rules.includes('required') &&
        values[variable.envVariable].trim() === ''
      ) {
        missing[variable.envVariable] = t('pages.server.startup.validation.required', {});
      }
    }
    setVariableErrors(missing);
    if (Object.keys(missing).length > 0) return;

    setSaving(true);
    updateVariables(
      server.uuid,
      Object.entries(values).map(([envVariable, value]) => ({ envVariable, value })),
    )
      .then(() => {
        addToast(t('pages.server.startup.toast.variablesUpdated', {}), 'success');
        for (const [envVariable, value] of Object.entries(values)) updateVariable(envVariable, { value });
        setValues({});
      })
      .catch((msg) => {
        const message = httpErrorToHuman(msg);
        const separator = message.indexOf(': ');
        const envVariable = separator > 0 ? message.slice(0, separator) : '';
        if (variables.some((variable) => variable.envVariable === envVariable)) {
          setVariableErrors({ [envVariable]: message.slice(separator + 2) });
        }
        addToast(message, 'error');
      })
      .finally(() => setSaving(false));
  };

  useKeyboardShortcut(
    's',
    () => {
      if (count > 0 && !saving) save();
    },
    { modifiers: ['ctrlOrMeta'], allowWhenInputFocused: true, deps: [values, saving] },
  );

  const commandLocked = !server.eggConfiguration?.startupAllowCustomCommand;
  const imageLocked =
    !settings.server.allowOverwritingCustomDockerImage && !Object.values(server.egg.dockerImages).includes(server.image);

  return (
    <ServerContentContainer
      title={t('pages.server.startup.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.startup.container}
    >
      <ConfirmationModal
        title={t('pages.server.startup.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => blocker.proceed()}
        confirm={t('common.button.leavePage', {})}
      >
        {t('pages.server.startup.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <div className='taxz-startup'>
        <Section icon={faSliders} title={t('pages.server.startup.variables', {})} subtitle='Einstellungen des Eggs für diesen Server'>
          {variablesLoading ? (
            <Spinner.Centered />
          ) : variablesError ? (
            <ErrorState error={httpErrorToHuman(variablesError)} onRetry={loadVariables} />
          ) : variables.length === 0 ? (
            <EmptyState
              icon={faSliders}
              title={t('pages.server.startup.empty.title', {})}
              description={t('pages.server.startup.empty.description', {})}
            />
          ) : (
            <div className='taxz-vform'>
              {variables.map((variable) => (
                <VariableRow
                  key={variable.envVariable}
                  variable={variable}
                  value={values[variable.envVariable] ?? currentValue(variable)}
                  changed={variable.envVariable in values}
                  disabled={!canModifyVariables || saving}
                  error={variableErrors[variable.envVariable]}
                  onChange={(value) => setValue(variable, value)}
                />
              ))}
            </div>
          )}
        </Section>

        <div className='taxz-startup-side'>
          <Section icon={faPlay} title={t('common.form.startupCommand', {})} subtitle='Änderungen werden sofort gespeichert'>
            {Object.keys(server.egg.startupCommands).length > 0 && (
              <Select
                label={t('pages.server.startup.predefinedStartupCommands', {})}
                data={[
                  ...((commandLocked && Object.values(server.egg.startupCommands).every((value) => value !== command)) ||
                  !commandLocked
                    ? [{ label: t('common.custom', {}), value: CUSTOM_COMMAND }]
                    : []),
                  ...Object.entries(server.egg.startupCommands).map(([key, value]) => ({ value, label: key })),
                ]}
                disabled={
                  !canModifyStartupCommand ||
                  (commandLocked && Object.values(server.egg.startupCommands).every((value) => value !== command))
                }
                value={customCommandSelected || !isPredefinedCommand(command) ? CUSTOM_COMMAND : command}
                onChange={(value) => {
                  if (!value || value === CUSTOM_COMMAND) {
                    setCustomCommandSelected(true);
                    return;
                  }
                  setCustomCommandSelected(false);
                  setCommand(value);
                }}
              />
            )}
            <TextArea
              aria-label={t('common.form.startupCommand', {})}
              className='taxz-startcmd'
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              readOnly={!canModifyStartupCommand || commandLocked}
              description={
                !canModifyStartupCommand
                  ? t('pages.server.startup.startupCommandNoPermission', {})
                  : commandLocked
                    ? t('pages.server.startup.startupCommandLocked', {})
                    : undefined
              }
              autosize
            />
          </Section>

          <Section icon={faDocker as typeof faPlay} title={t('common.form.dockerImage', {})} subtitle='Änderungen werden sofort gespeichert'>
            <Select
              aria-label={t('common.form.dockerImage', {})}
              value={dockerImage}
              onChange={(value) => setDockerImage(value ?? '')}
              data={Object.entries(server.egg.dockerImages).map(([key, value]) => ({ value, label: key }))}
              searchable
              disabled={!canModifyDockerImage || imageLocked}
            />
            <p className='taxz-hint'>
              {imageLocked
                ? t('pages.server.startup.dockerImageDescriptionCustom', {})
                : t('pages.server.startup.dockerImageDescription', {})}
            </p>
          </Section>
        </div>

        <SaveBar count={count} saving={saving} canSave={canModifyVariables} onDiscard={discard} onSave={save} />
      </div>
    </ServerContentContainer>
  );
}

export default function ServerStartup() {
  const isTaxz = useIsTaxz();
  return isTaxz ? <TaxzServerStartup /> : <OriginalServerStartup />;
}
