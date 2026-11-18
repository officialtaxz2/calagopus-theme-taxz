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
import { type Accent, type Background, BUILTIN_DEFAULTS, type ThemeChoice } from './prefs.ts';

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
      .then(() =>
        addToast('Vorgaben gespeichert. Neu geladene Seiten zeigen sie, spätestens nach einer Minute.', 'success'),
      )
      .catch((error) => addToast(httpErrorToHuman(error), 'error'))
      .finally(() => setSaving(false));
  };

  return (
    <TitleCard title='Vorgaben für Benutzer ohne eigene Wahl'>
      <Stack>
        <p className='text-sm text-(--mantine-color-dimmed)'>
          Jeder Benutzer kann unter Konto → Darstellung selbst wählen. Diese Werte gelten, solange er das nicht getan
          hat, und auf der Anmeldeseite.
        </p>
        <Select
          label='Theme'
          value={values.theme}
          disabled={!loaded}
          onChange={(value) => value && set('theme', value as ThemeChoice)}
          data={[
            { value: 'taxz', label: 'taxz' },
            { value: 'standard', label: 'Standard (Calagopus wie bisher)' },
          ]}
        />
        <Select
          label='Hintergrund'
          value={values.background}
          disabled={!loaded}
          onChange={(value) => value && set('background', value as Background)}
          data={[
            { value: 'horizon', label: 'Horizont' },
            { value: 'topo', label: 'Topografie' },
            { value: 'aurora', label: 'Nordlicht' },
          ]}
        />
        <Select
          label='Akzentfarbe'
          value={values.accent}
          disabled={!loaded}
          onChange={(value) => value && set('accent', value as Accent)}
          data={[
            { value: 'violet', label: 'Violett' },
            { value: 'sky', label: 'Eisblau' },
            { value: 'emerald', label: 'Smaragd' },
            { value: 'glut', label: 'Glut' },
          ]}
        />
        <Select
          label='Serverbilder'
          value={values.art}
          disabled={!loaded}
          onChange={(value) => value && set('art', value as ApiDefaults['art'])}
          data={[
            { value: 'colors', label: 'Spielfarben' },
            { value: 'icon', label: 'Icon-Schein' },
            { value: 'illu', label: 'Illustration' },
          ]}
        />
        <Select
          label='Serverliste'
          value={values.server_view}
          disabled={!loaded}
          onChange={(value) => value && set('server_view', value as ApiDefaults['server_view'])}
          data={[
            { value: 'cards', label: 'Karten' },
            { value: 'list', label: 'Liste' },
          ]}
        />
        <Switch
          label='Größere Schrift'
          checked={values.large_font}
          disabled={!loaded}
          onChange={(event) => set('large_font', event.currentTarget.checked)}
        />
        <Switch
          label='Starker Kontrast'
          checked={values.strong_contrast}
          disabled={!loaded}
          onChange={(event) => set('strong_contrast', event.currentTarget.checked)}
        />
        <Button onClick={save} loading={saving} disabled={!loaded} className='w-fit!'>
          Speichern
        </Button>
      </Stack>
    </TitleCard>
  );
}
