// Einstellungen des taxz-Themes: Vorgaben des Admins (aus index.html) plus die eigene Wahl des Benutzers
// (Benutzereinstellungen des Panels, gelten auf allen Geraeten). Angewendet wird alles als data-Attribute
// auf <html>; das CSS des Themes greift nur bei data-taxz, "Standard" bleibt also unveraendert.

import { z } from 'zod';
import { getUserSetting, subscribeUserSetting, useUserSetting } from '@/lib/userSettings.ts';

export const PACKAGE_NAME = 'de.taxz.theme';
export const PREFS_KEY = 'de.taxz.theme::prefs';

export const THEMES = ['standard', 'taxz'] as const;
export const BACKGROUNDS = ['horizon', 'topo', 'aurora'] as const;
export const ACCENTS = ['violet', 'sky', 'emerald', 'glut'] as const;
export const ARTS = ['colors', 'icon', 'illu'] as const;
export const SERVER_VIEWS = ['cards', 'list'] as const;

export type ThemeChoice = (typeof THEMES)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Accent = (typeof ACCENTS)[number];
export type ServerArt = (typeof ARTS)[number];
export type ServerView = (typeof SERVER_VIEWS)[number];

export interface ThemePrefs {
  theme: ThemeChoice;
  background: Background;
  accent: Accent;
  art: ServerArt;
  largeFont: boolean;
  strongContrast: boolean;
  serverView: ServerView;
}

// Vorgabe laut Designvorgabe (Horizont + Violett + Spielfarben), falls der Admin noch nichts gespeichert hat.
export const BUILTIN_DEFAULTS: ThemePrefs = {
  theme: 'taxz',
  background: 'horizon',
  accent: 'violet',
  art: 'colors',
  largeFont: false,
  strongContrast: false,
  serverView: 'cards',
};

// Gespeichert wird nur, was der Benutzer selbst gewaehlt hat. Unbekannte oder kaputte Werte fallen weg.
const userPrefsSchema = z
  .object({
    theme: z.enum(THEMES).optional().catch(undefined),
    background: z.enum(BACKGROUNDS).optional().catch(undefined),
    accent: z.enum(ACCENTS).optional().catch(undefined),
    art: z.enum(ARTS).optional().catch(undefined),
    largeFont: z.boolean().optional().catch(undefined),
    strongContrast: z.boolean().optional().catch(undefined),
    serverView: z.enum(SERVER_VIEWS).optional().catch(undefined),
  })
  .catch({});

export type UserPrefs = z.infer<typeof userPrefsSchema>;

const adminDefaultsSchema = z
  .object({
    theme: z.enum(THEMES).catch(BUILTIN_DEFAULTS.theme),
    background: z.enum(BACKGROUNDS).catch(BUILTIN_DEFAULTS.background),
    accent: z.enum(ACCENTS).catch(BUILTIN_DEFAULTS.accent),
    art: z.enum(ARTS).catch(BUILTIN_DEFAULTS.art),
    large_font: z.boolean().catch(BUILTIN_DEFAULTS.largeFont),
    strong_contrast: z.boolean().catch(BUILTIN_DEFAULTS.strongContrast),
    server_view: z.enum(SERVER_VIEWS).catch(BUILTIN_DEFAULTS.serverView),
  })
  .transform((d): ThemePrefs => ({
    theme: d.theme,
    background: d.background,
    accent: d.accent,
    art: d.art,
    largeFont: d.large_font,
    strongContrast: d.strong_contrast,
    serverView: d.server_view,
  }));

let adminDefaults: ThemePrefs = BUILTIN_DEFAULTS;

export function setAdminDefaultsFromIndex(raw: unknown) {
  if (raw === undefined) return;
  const parsed = adminDefaultsSchema.safeParse(raw);
  if (parsed.success) adminDefaults = parsed.data;
  else console.error('taxz theme: invalid admin defaults, using built-in defaults', parsed.error);
}

export function getAdminDefaults(): ThemePrefs {
  return adminDefaults;
}

function stripUndefined(prefs: UserPrefs): Partial<ThemePrefs> {
  return Object.fromEntries(Object.entries(prefs).filter(([, value]) => value !== undefined)) as Partial<ThemePrefs>;
}

export function resolvePrefs(user: UserPrefs): ThemePrefs {
  return { ...adminDefaults, ...stripUndefined(user) };
}

export function getEffectivePrefs(): ThemePrefs {
  return resolvePrefs(getUserSetting(PREFS_KEY, userPrefsSchema, {}));
}

export function useThemePrefs(): [ThemePrefs, (patch: Partial<ThemePrefs>) => void, UserPrefs] {
  const [user, setUser] = useUserSetting(PREFS_KEY, userPrefsSchema, {});
  const update = (patch: Partial<ThemePrefs>) => setUser((previous) => ({ ...previous, ...patch }));
  return [resolvePrefs(user), update, user];
}

export function isTaxzActive(): boolean {
  return document.documentElement.dataset.taxz === 'on';
}

export function useIsTaxz(): boolean {
  return useThemePrefs()[0].theme === 'taxz';
}

export function applyPrefs(prefs: ThemePrefs) {
  const root = document.documentElement;
  if (prefs.theme !== 'taxz') {
    for (const attribute of [
      'data-taxz',
      'data-taxz-bg',
      'data-taxz-accent',
      'data-taxz-art',
      'data-taxz-large',
      'data-taxz-contrast',
    ]) {
      root.removeAttribute(attribute);
    }
    return;
  }

  root.dataset.taxz = 'on';
  root.dataset.taxzBg = prefs.background;
  root.dataset.taxzAccent = prefs.accent;
  root.dataset.taxzArt = prefs.art;
  if (prefs.largeFont) root.dataset.taxzLarge = 'on';
  else root.removeAttribute('data-taxz-large');
  if (prefs.strongContrast) root.dataset.taxzContrast = 'on';
  else root.removeAttribute('data-taxz-contrast');
}

export function watchPrefs(onChange: (prefs: ThemePrefs) => void): () => void {
  return subscribeUserSetting(PREFS_KEY, () => onChange(getEffectivePrefs()));
}
