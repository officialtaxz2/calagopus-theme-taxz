// Konto -> Darstellung: jeder Benutzer waehlt Theme, Hell/Dunkel, Hintergrund, Akzent, Serverbilder, Serverliste,
// Schrift und Kontrast (Designvorgabe 2.).
// Die Seite muss auch im Standard-Theme gut aussehen (dort waehlt man taxz aus), deshalb haengt ihr eigenes CSS
// an .taxz-ap und nicht an data-taxz.

import {
  faCircleHalfStroke,
  faFont,
  faImage,
  faImages,
  faList,
  faPalette,
  faSwatchbook,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type MantineColorScheme, useMantineColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { type ReactNode, useId } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Switch from '@/elements/input/Switch.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import { backdropMarkup } from './backdrop.ts';
import { gameLook } from './games.ts';
import {
  ACCENTS,
  type Accent,
  ARTS,
  BACKGROUNDS,
  type Background,
  getAdminDefaults,
  PREFS_KEY,
  type ServerArt,
  type ServerView,
  THEMES,
  type ThemeChoice,
  useThemePrefs,
} from './prefs.ts';
import { removeUserSetting } from '@/lib/userSettings.ts';
import { ServerArtLayer } from './ServerArt.tsx';
import { getExtTranslations, useExtTranslations } from './translations.ts';

// Namen der Auswahlmoeglichkeiten, auch fuer die Admin-Vorgaben und das Willkommensfenster.
export function themeText(theme: ThemeChoice): [string, string] {
  const { t } = getExtTranslations();
  return [t(`look.theme.${theme}.title`, {}), t(`look.theme.${theme}.subtitle`, {})];
}

export function backgroundText(background: Background): [string, string] {
  const { t } = getExtTranslations();
  return [t(`look.background.${background}.title`, {}), t(`look.background.${background}.subtitle`, {})];
}

export function accentText(accent: Accent): string {
  return getExtTranslations().t(`look.accent.${accent}`, {});
}

export function artText(art: ServerArt): [string, string] {
  const { t } = getExtTranslations();
  return [t(`look.art.${art}.title`, {}), t(`look.art.${art}.subtitle`, {})];
}

export function viewText(view: ServerView): string {
  return getExtTranslations().t(`look.view.${view}`, {});
}

const PREVIEW_LOOK = gameLook({ name: 'Paper' });

export const ACCENT_ORDER: Accent[] = ['sky', 'violet', 'emerald', 'glut'];

function MiniCards({ standard = false }: { standard?: boolean }) {
  return (
    <span className={classNames('taxz-mini-cards', standard && 'is-standard')}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function MiniPreview({ background, accent, standard = false }: { background: Background; accent: Accent; standard?: boolean }) {
  return (
    <span
      className={classNames('taxz-preview taxz-mini', standard && 'is-standard')}
      data-taxz-accent={accent}
      aria-hidden='true'
    >
      {!standard && (
        <span className='taxz-mini-bg' data-bg={background} dangerouslySetInnerHTML={{ __html: backdropMarkup(background) }} />
      )}
      <MiniCards standard={standard} />
    </span>
  );
}

export function Tile<T extends string>({
  name,
  value,
  checked,
  onSelect,
  title,
  subtitle,
  disabled,
  children,
}: {
  name: string;
  value: T;
  checked: boolean;
  onSelect: (value: T) => void;
  title: string;
  subtitle: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={classNames('taxz-tile', checked && 'is-on', disabled && 'is-disabled')}>
      <input
        type='radio'
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className='taxz-sr'
      />
      {children}
      <span className='taxz-tile-text'>
        <b>{title}</b>
        <small>{subtitle}</small>
      </span>
      {checked && (
        <span className='taxz-tile-check' aria-hidden='true'>
          <svg viewBox='0 0 16 16'>
            <path d='M3.5 8.5l3 3 6-7' />
          </svg>
        </span>
      )}
    </label>
  );
}

export default function AppearancePage() {
  const [prefs, update, userPrefs] = useThemePrefs();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const groupId = useId();
  const taxzOff = prefs.theme !== 'taxz';
  const hasOwnChoice = Object.values(userPrefs).some((value) => value !== undefined);
  const admin = getAdminDefaults();
  const { t } = useExtTranslations();

  return (
    <AccountContentContainer title={t('appearance.title', {})} subtitle={t('appearance.subtitle', {})}>
      <div className='taxz-ap'>
        <TitleCard title={t('appearance.theme.title', {})} icon={<FontAwesomeIcon icon={faSwatchbook} />}>
          <p className='taxz-ap-lead'>{t('appearance.theme.lead', {})}</p>
          <div className='taxz-tiles taxz-tiles-2' role='radiogroup' aria-label={t('appearance.theme.title', {})}>
            {THEMES.map((theme) => (
              <Tile
                key={theme}
                name={`${groupId}-theme`}
                value={theme}
                checked={prefs.theme === theme}
                onSelect={(value) => update({ theme: value })}
                title={themeText(theme)[0]}
                subtitle={themeText(theme)[1]}
              >
                <MiniPreview background={prefs.background} accent={prefs.accent} standard={theme === 'standard'} />
              </Tile>
            ))}
          </div>
        </TitleCard>

        <TitleCard title={t('appearance.scheme.title', {})} icon={<FontAwesomeIcon icon={faCircleHalfStroke} />}>
          <SegmentedControl
            aria-label={t('appearance.scheme.title', {})}
            value={colorScheme}
            onChange={(value) => setColorScheme(value as MantineColorScheme)}
            data={[
              { value: 'auto', label: t('appearance.scheme.auto', {}) },
              { value: 'light', label: t('appearance.scheme.light', {}) },
              { value: 'dark', label: t('appearance.scheme.dark', {}) },
            ]}
          />
          <p className='taxz-ap-note'>{t('appearance.scheme.note', {})}</p>
        </TitleCard>

        <fieldset className='taxz-ap-taxz' disabled={taxzOff}>
          {taxzOff && <p className='taxz-ap-hint'>{t('appearance.taxzOnly', {})}</p>}

          <TitleCard title={t('appearance.background.title', {})} icon={<FontAwesomeIcon icon={faImage} />}>
            <div className='taxz-tiles taxz-tiles-3' role='radiogroup' aria-label={t('appearance.background.title', {})}>
              {BACKGROUNDS.map((background) => (
                <Tile
                  key={background}
                  name={`${groupId}-bg`}
                  value={background}
                  checked={prefs.background === background}
                  onSelect={(value) => update({ background: value })}
                  title={backgroundText(background)[0]}
                  subtitle={backgroundText(background)[1]}
                  disabled={taxzOff}
                >
                  <MiniPreview background={background} accent={prefs.accent} />
                </Tile>
              ))}
            </div>
          </TitleCard>

          <TitleCard title={t('appearance.accent.title', {})} icon={<FontAwesomeIcon icon={faPalette} />}>
            <p className='taxz-ap-lead'>{t('appearance.accent.lead', {})}</p>
            <div className='taxz-swatches' role='radiogroup' aria-label={t('appearance.accent.title', {})}>
              {ACCENT_ORDER.filter((accent) => ACCENTS.includes(accent)).map((accent) => (
                <label
                  key={accent}
                  className={classNames('taxz-swatch', prefs.accent === accent && 'is-on')}
                  data-taxz-accent={accent}
                >
                  <input
                    type='radio'
                    name={`${groupId}-accent`}
                    value={accent}
                    checked={prefs.accent === accent}
                    disabled={taxzOff}
                    onChange={() => update({ accent })}
                    className='taxz-sr'
                  />
                  <span className='taxz-swatch-dot taxz-preview' data-taxz-accent={accent} aria-hidden='true'>
                    {prefs.accent === accent && (
                      <svg viewBox='0 0 16 16'>
                        <path d='M3.5 8.5l3 3 6-7' />
                      </svg>
                    )}
                  </span>
                  {accentText(accent)}
                </label>
              ))}
            </div>
          </TitleCard>

          <TitleCard title={t('appearance.art.title', {})} icon={<FontAwesomeIcon icon={faImages} />}>
            <p className='taxz-ap-lead'>{t('appearance.art.lead', {})}</p>
            <div className='taxz-tiles taxz-tiles-3' role='radiogroup' aria-label={t('appearance.art.title', {})}>
              {ARTS.map((art) => (
                <Tile
                  key={art}
                  name={`${groupId}-art`}
                  value={art}
                  checked={prefs.art === art}
                  onSelect={(value) => update({ art: value })}
                  title={artText(art)[0]}
                  subtitle={artText(art)[1]}
                  disabled={taxzOff}
                >
                  <span className='taxz-art-mini taxz-preview' data-taxz-accent={prefs.accent} aria-hidden='true'>
                    <ServerArtLayer look={PREVIEW_LOOK} art={art} seedText='vorschau' />
                  </span>
                </Tile>
              ))}
            </div>
          </TitleCard>

          <TitleCard title={t('appearance.view.title', {})} icon={<FontAwesomeIcon icon={faList} />}>
            <SegmentedControl
              aria-label={t('appearance.view.label', {})}
              value={prefs.serverView}
              disabled={taxzOff}
              onChange={(value) => update({ serverView: value as ServerView })}
              data={(['cards', 'list'] as ServerView[]).map((view) => ({ value: view, label: viewText(view) }))}
            />
            <p className='taxz-ap-note'>{t('appearance.view.note', {})}</p>
          </TitleCard>

          <TitleCard title={t('appearance.readability.title', {})} icon={<FontAwesomeIcon icon={faFont} />}>
            <div className='taxz-ap-switches'>
              <Switch
                label={t('appearance.readability.largeFont', {})}
                description={t('appearance.readability.largeFontDescription', {})}
                checked={prefs.largeFont}
                disabled={taxzOff}
                onChange={(event) => update({ largeFont: event.currentTarget.checked })}
              />
              <Switch
                label={t('appearance.readability.strongContrast', {})}
                description={t('appearance.readability.strongContrastDescription', {})}
                checked={prefs.strongContrast}
                disabled={taxzOff}
                onChange={(event) => update({ strongContrast: event.currentTarget.checked })}
              />
            </div>
          </TitleCard>
        </fieldset>

        <div className='taxz-ap-foot'>
          <p>
            {t('appearance.adminDefault', {
              theme: themeText(admin.theme)[0],
              background: backgroundText(admin.background)[0],
              accent: accentText(admin.accent),
            })}
          </p>
          {hasOwnChoice && (
            <Button variant='subtle' onClick={() => removeUserSetting(PREFS_KEY)}>
              {t('appearance.reset', {})}
            </Button>

          )}
        </div>
      </div>
    </AccountContentContainer>
  );
}
