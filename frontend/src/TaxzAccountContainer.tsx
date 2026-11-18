// Karte "Konto" (Name, Benutzername, Sprache) im taxz-Theme mit der Speichern-Leiste (Designvorgabe 7.5) statt des Knopfs
// "Aktualisieren": sie erscheint erst, wenn etwas geaendert ist, und bietet "Verwerfen". Felder, Pruefung, Anfrage und
// Meldungen sind die des Panels. Passwort und E-Mail behalten ihre eigenen Knoepfe, weil sie das aktuelle Passwort abfragen
// (Aktionen, keine Einstellungen). Mit "Standard" rendert das Original.

import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateAccount from '@/api/me/account/updateAccount.ts';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { dashboardAccountSchema } from '@/lib/schemas/dashboard.ts';
import OriginalAccountContainer from '@/pages/dashboard/account/AccountContainer.tsx';
import type { AccountCardProps } from '@/pages/dashboard/account/DashboardAccount.tsx';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import FormSaveBar from './FormSaveBar.tsx';
import { useIsTaxz } from './prefs.ts';

function TaxzAccount({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const languages = useGlobalStore((state) => state.languages);
  const settings = useGlobalStore((state) => state.settings);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardAccountSchema>>({
    initialValues: {
      username: '',
      nameFirst: '',
      nameLast: '',
      language: '',
    },
    ...liveValidation,
    validate: zod4Resolver(dashboardAccountSchema),
  });

  useEffect(() => {
    if (user) {
      const values = {
        username: user.username,
        nameFirst: user.nameFirst ?? '',
        nameLast: user.nameLast ?? '',
        language: user.language,
      };
      // Gespeicherter Stand = Vergleichsbasis der Leiste
      form.setValues(values);
      form.resetDirty(values);
    }
  }, [user?.username, user?.nameFirst, user?.nameLast, user?.language]);

  const doUpdate = () => {
    setLoading(true);

    const submitted = form.getValues();
    const values = dashboardAccountSchema.parse(submitted);

    updateAccount(values)
      .then(() => {
        addToast(t('pages.account.account.containers.account.toast.updated', {}), 'success');
        form.resetDirty(submitted);

        setUser({
          ...user!,
          ...values,
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.account.account.containers.account.title', {})}
      icon={<FontAwesomeIcon icon={faUser} />}
      className={classNames('h-full order-50', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <Group grow>
            <TextInput
              label={t('common.form.firstName', {})}
              autoComplete='given-name'
              {...form.getInputProps('nameFirst')}
            />
            <TextInput
              label={t('common.form.lastName', {})}
              autoComplete='family-name'
              {...form.getInputProps('nameLast')}
            />
          </Group>
          <Group grow>
            <TextInput
              withAsterisk
              label={t('common.form.username', {})}
              autoComplete='username'
              {...form.getInputProps('username')}
            />
            {settings.user.allowChangingLanguage && (
              <Select
                withAsterisk
                label={t('common.form.language', {})}
                data={languages.map((language) => ({
                  label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                  value: language,
                }))}
                {...form.getInputProps('language')}
              />
            )}
          </Group>
          <FormSaveBar form={form} loading={loading} canSave={form.isValid()} />
        </Stack>
      </form>
    </TitleCard>
  );
}

export default function TaxzAccountContainer(props: AccountCardProps) {
  const isTaxz = useIsTaxz();
  if (!isTaxz) return <OriginalAccountContainer {...props} />;
  return <TaxzAccount {...props} />;
}
