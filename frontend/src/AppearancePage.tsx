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

const THEME_TEXT: Record<ThemeChoice, [string, string]> = {
  standard: ['Standard', 'Calagopus wie bisher'],
  taxz: ['taxz', 'Das neue Design'],
};

export const BG_TEXT: Record<Background, [string, string]> = {
  horizon: ['Horizont', 'Leuchtender Bogen unten'],
  topo: ['Topografie', 'Höhenlinien, ruhig'],
  aurora: ['Nordlicht', 'Langsame Farbwolken'],
};

export const ACCENT_TEXT: Record<Accent, string> = {
  violet: 'Violett',
  sky: 'Eisblau',
  emerald: 'Smaragd',
  glut: 'Glut',
};

const ART_TEXT: Record<ServerArt, [string, string]> = {
  colors: ['Spielfarben', 'Farben und Symbol des Spiels'],
  icon: ['Icon-Schein', 'Weicher Schein des Symbols'],
  illu: ['Illustration', 'Kleine Landschaft je Spiel'],
};

const VIEW_TEXT: Record<ServerView, string> = { cards: 'Karten', list: 'Liste' };

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

  return (
    <AccountContentContainer title='Darstellung' subtitle='Gilt nur für dich und wird sofort übernommen'>
      <div className='taxz-ap'>
        <TitleCard title='Theme' icon={<FontAwesomeIcon icon={faSwatchbook} />}>
          <p className='taxz-ap-lead'>Jeder wählt selbst, der Wechsel geht jederzeit zurück.</p>
          <div className='taxz-tiles taxz-tiles-2' role='radiogroup' aria-label='Theme'>
            {THEMES.map((theme) => (
              <Tile
                key={theme}
                name={`${groupId}-theme`}
                value={theme}
                checked={prefs.theme === theme}
                onSelect={(value) => update({ theme: value })}
                title={THEME_TEXT[theme][0]}
                subtitle={THEME_TEXT[theme][1]}
              >
                <MiniPreview background={prefs.background} accent={prefs.accent} standard={theme === 'standard'} />
              </Tile>
            ))}
          </div>
        </TitleCard>

        <TitleCard title='Hell oder dunkel' icon={<FontAwesomeIcon icon={faCircleHalfStroke} />}>
          <SegmentedControl
            aria-label='Hell oder dunkel'
            value={colorScheme}
            onChange={(value) => setColorScheme(value as MantineColorScheme)}
            data={[
              { value: 'auto', label: 'Wie das Gerät' },
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
            ]}
          />
          <p className='taxz-ap-note'>Gilt auf diesem Gerät, wie der Schalter unten in der Seitenleiste.</p>
        </TitleCard>

        <fieldset className='taxz-ap-taxz' disabled={taxzOff}>
          {taxzOff && <p className='taxz-ap-hint'>Die folgenden Einstellungen gelten für das Theme „taxz“.</p>}

          <TitleCard title='Hintergrund' icon={<FontAwesomeIcon icon={faImage} />}>
            <div className='taxz-tiles taxz-tiles-3' role='radiogroup' aria-label='Hintergrund'>
              {BACKGROUNDS.map((background) => (
                <Tile
                  key={background}
                  name={`${groupId}-bg`}
                  value={background}
                  checked={prefs.background === background}
                  onSelect={(value) => update({ background: value })}
                  title={BG_TEXT[background][0]}
                  subtitle={BG_TEXT[background][1]}
                  disabled={taxzOff}
                >
                  <MiniPreview background={background} accent={prefs.accent} />
                </Tile>
              ))}
            </div>
          </TitleCard>

          <TitleCard title='Akzentfarbe' icon={<FontAwesomeIcon icon={faPalette} />}>
            <p className='taxz-ap-lead'>Für Knöpfe, Auswahl und Anzeigen. Statusfarben wie „Läuft“ bleiben immer gleich.</p>
            <div className='taxz-swatches' role='radiogroup' aria-label='Akzentfarbe'>
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
                  {ACCENT_TEXT[accent]}
                </label>
              ))}
            </div>
          </TitleCard>

          <TitleCard title='Serverbilder' icon={<FontAwesomeIcon icon={faImages} />}>
            <p className='taxz-ap-lead'>Kopf der Serverkarten in der Serverliste. Gilt für jedes Spiel gleich.</p>
            <div className='taxz-tiles taxz-tiles-3' role='radiogroup' aria-label='Serverbilder'>
              {ARTS.map((art) => (
                <Tile
                  key={art}
                  name={`${groupId}-art`}
                  value={art}
                  checked={prefs.art === art}
                  onSelect={(value) => update({ art: value })}
                  title={ART_TEXT[art][0]}
                  subtitle={ART_TEXT[art][1]}
                  disabled={taxzOff}
                >
                  <span className='taxz-art-mini taxz-preview' data-taxz-accent={prefs.accent} aria-hidden='true'>
                    <ServerArtLayer look={PREVIEW_LOOK} art={art} seedText='vorschau' />
                  </span>
                </Tile>
              ))}
            </div>
          </TitleCard>

          <TitleCard title='Serverliste' icon={<FontAwesomeIcon icon={faList} />}>
            <SegmentedControl
              aria-label='Ansicht der Serverliste'
              value={prefs.serverView}
              disabled={taxzOff}
              onChange={(value) => update({ serverView: value as ServerView })}
              data={(['cards', 'list'] as ServerView[]).map((view) => ({ value: view, label: VIEW_TEXT[view] }))}
            />
            <p className='taxz-ap-note'>Lässt sich auch direkt auf der Serverliste umschalten.</p>
          </TitleCard>

          <TitleCard title='Lesbarkeit' icon={<FontAwesomeIcon icon={faFont} />}>
            <div className='taxz-ap-switches'>
              <Switch
                label='Größere Schrift'
                description='Alle Texte etwas größer, mindestens 14 px.'
                checked={prefs.largeFont}
                disabled={taxzOff}
                onChange={(event) => update({ largeFont: event.currentTarget.checked })}
              />
              <Switch
                label='Starker Kontrast'
                description='Deckende Karten statt Glas, kräftigere Rahmen und Texte. Ist „Mehr Kontrast“ im System an, gilt das automatisch.'
                checked={prefs.strongContrast}
                disabled={taxzOff}
                onChange={(event) => update({ strongContrast: event.currentTarget.checked })}
              />
            </div>
          </TitleCard>
        </fieldset>

        <div className='taxz-ap-foot'>
          <p>
            Der Admin legt fest, was Benutzer ohne eigene Wahl sehen (derzeit: {THEME_TEXT[admin.theme][0]},{' '}
            {BG_TEXT[admin.background][0]}, {ACCENT_TEXT[admin.accent]}).
          </p>
          {hasOwnChoice && (
            <Button variant='subtle' onClick={() => removeUserSetting(PREFS_KEY)}>
              Eigene Wahl löschen, Vorgabe nutzen
            </Button>
          )}
        </div>
      </div>
    </AccountContentContainer>
  );
}
