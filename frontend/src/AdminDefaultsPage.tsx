// Admin -> Erweiterungen -> taxz Theme -> Konfigurieren: was Benutzer ohne eigene Wahl bekommen.
// Wirkt auch auf die Anmeldeseite, weil dort noch kein Benutzer bekannt ist.

import { Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { accentText, artText, backgroundText, themeText, viewText } from './AppearancePage.tsx';
import { ACCENTS, type Accent, ARTS, BACKGROUNDS, type Background, BUILTIN_DEFAULTS, SERVER_VIEWS, type ThemeChoice } from './prefs.ts';
import { useExtTranslations } from './translations.ts';

const API = '/api/admin/extensions/de.taxz.theme/defaults';

interface ApiDefaults {
  theme: ThemeChoice;
  background: Background;
  accent: Accent;
  art: 'colors' | 'icon' | 'illu';
  large_font: boolean;
  strong_contrast: boolean;
  server_view: 'cards' | 'list';
}

const INITIAL: ApiDefaults = {
  theme: BUILTIN_DEFAULTS.theme,
  background: BUILTIN_DEFAULTS.background,
  accent: BUILTIN_DEFAULTS.accent,
  art: BUILTIN_DEFAULTS.art,
  large_font: BUILTIN_DEFAULTS.largeFont,
  strong_contrast: BUILTIN_DEFAULTS.strongContrast,
  server_view: BUILTIN_DEFAULTS.serverView,
};

export default function AdminDefaultsPage() {
  const { addToast } = useToast();
  const [values, setValues] = useState<ApiDefaults>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useExtTranslations();

  useEffect(() => {
    axiosInstance
      .get<{ defaults: ApiDefaults }>(API)
      .then(({ data }) => {
        setValues({ ...INITIAL, ...data.defaults });
        setLoaded(true);
      })
      .catch((error) => addToast(httpErrorToHuman(error), 'error'));
  }, []);

  const set = <K extends keyof ApiDefaults>(key: K, value: ApiDefaults[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const save = () => {
    setSaving(true);
    axiosInstance
      .put(API, { defaults: values })
      .then(() => addToast(t('admin.defaults.saved', {}), 'success'))
      .catch((error) => addToast(httpErrorToHuman(error), 'error'))
      .finally(() => setSaving(false));
  };

  return (
    <TitleCard title={t('admin.defaults.title', {})}>
      <Stack>
        <p className='text-sm text-(--mantine-color-dimmed)'>{t('admin.defaults.lead', {})}</p>
        <Select
          label={t('appearance.theme.title', {})}
          value={values.theme}
          disabled={!loaded}
          onChange={(value) => value && set('theme', value as ThemeChoice)}
          data={[
            { value: 'taxz', label: themeText('taxz')[0] },
            { value: 'standard', label: t('admin.defaults.standardOption', {}) },
          ]}
        />
        <Select
          label={t('appearance.background.title', {})}
          value={values.background}
          disabled={!loaded}
          onChange={(value) => value && set('background', value as Background)}
          data={BACKGROUNDS.map((value) => ({ value, label: backgroundText(value)[0] }))}
        />
        <Select
          label={t('appearance.accent.title', {})}
          value={values.accent}
          disabled={!loaded}
          onChange={(value) => value && set('accent', value as Accent)}
          data={ACCENTS.map((value) => ({ value, label: accentText(value) }))}
        />
        <Select
          label={t('appearance.art.title', {})}
          value={values.art}
          disabled={!loaded}
          onChange={(value) => value && set('art', value as ApiDefaults['art'])}
          data={ARTS.map((value) => ({ value, label: artText(value)[0] }))}
        />
        <Select
          label={t('appearance.view.title', {})}
          value={values.server_view}
          disabled={!loaded}
          onChange={(value) => value && set('server_view', value as ApiDefaults['server_view'])}
          data={SERVER_VIEWS.map((value) => ({ value, label: viewText(value) }))}
        />
        <Switch
          label={t('appearance.readability.largeFont', {})}
          checked={values.large_font}
          disabled={!loaded}
          onChange={(event) => set('large_font', event.currentTarget.checked)}
        />
        <Switch
          label={t('appearance.readability.strongContrast', {})}
          checked={values.strong_contrast}
          disabled={!loaded}
          onChange={(event) => set('strong_contrast', event.currentTarget.checked)}
        />
        <Button onClick={save} loading={saving} disabled={!loaded} className='w-fit!'>
          {t('common.save', {})}

        </Button>
      </Stack>
    </TitleCard>
  );
}
