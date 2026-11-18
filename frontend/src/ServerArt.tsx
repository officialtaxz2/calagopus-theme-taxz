// Kartenkopf der Serverliste in den drei Arten aus Designvorgabe 5. (Spielfarben, Icon-Schein, Illustration)
// und das Server-Symbol. Alle SVGs entstehen hier aus festen Farben und Zahlen, nie aus Texten der Benutzer.
// Hat der Server ein eigenes Bild (Idee 22), nutzen es alle drei Arten: Spielfarben statt des grossen Spielsymbols,
// Icon-Schein weichgezeichnet als Schein plus scharfe Kachel rechts, Illustration mit der Kachel. Das Server-Symbol zeigt es ganz.

import { useComputedColorScheme } from '@mantine/core';
import { type CSSProperties, useMemo } from 'react';
import type { ServerArt as ArtChoice } from './prefs.ts';
import { type GameLook, type IlluKind, seedOf } from './games.ts';

function rnd(seed: number) {
  let x = (seed % 2147483646) + 1;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

function wave(W: number, H: number, base: number, parts: [number, number, number][], seed: number) {
  let d = `M0 ${H}`;
  for (let i = 0; i <= 48; i++) {
    const x = (W * i) / 48;
    let y = base;
    for (const [a, f, p] of parts) y += a * Math.sin((i / 48) * f * 2 * Math.PI + p + seed);
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} L${W} ${H} Z`;
}

interface IlluPalette {
  sky: string[];
  sun: string;
  glow: string;
  far: string;
  mid: string;
  near: string;
  stars?: boolean;
}

const ILLU: Record<IlluKind, { dark: IlluPalette; light: IlluPalette }> = {
  meadow: {
    dark: {
      sky: ['#1d1838', '#4a2547', '#c9603a'],
      sun: '#ffd28f',
      glow: '#ff8a3a',
      far: '#3b3462',
      mid: '#2c5a46',
      near: '#183424',
    },
    light: {
      sky: ['#86c3f2', '#cde5f7', '#ffe2c2'],
      sun: '#fff4d6',
      glow: '#ffcf86',
      far: '#a3b3d6',
      mid: '#78ad76',
      near: '#4a874a',
    },
  },
  night: {
    dark: {
      sky: ['#0a0f20', '#18223d', '#2b3658'],
      sun: '#e8ecf5',
      glow: '#8fa3d6',
      far: '#262f4d',
      mid: '#1c2833',
      near: '#121a21',
      stars: true,
    },
    light: {
      sky: ['#9fb8d8', '#c9d8ea', '#eef2f8'],
      sun: '#ffffff',
      glow: '#c9dbff',
      far: '#8d9fbf',
      mid: '#5f7a94',
      near: '#3e5568',
    },
  },
  dunes: {
    dark: {
      sky: ['#1a1024', '#4a1f2c', '#c2582a'],
      sun: '#ffc27a',
      glow: '#ff7a2a',
      far: '#5a2f2c',
      mid: '#7a3f22',
      near: '#3a1d12',
    },
    light: {
      sky: ['#ffd9b0', '#ffe9cf', '#fff5e8'],
      sun: '#fff6e0',
      glow: '#ffb36b',
      far: '#e5b07f',
      mid: '#cf8a55',
      near: '#a8643a',
    },
  },
  snow: {
    dark: {
      sky: ['#0d1426', '#1d2c4a', '#3d5a80'],
      sun: '#eef4ff',
      glow: '#9cc4ff',
      far: '#3a4d6d',
      mid: '#7f97b8',
      near: '#cfdcee',
      stars: true,
    },
    light: {
      sky: ['#b9d6f2', '#dceaf7', '#f4f8fc'],
      sun: '#ffffff',
      glow: '#d6e8ff',
      far: '#a9bfd9',
      mid: '#d3e1f0',
      near: '#f2f6fb',
    },
  },
  city: {
    dark: {
      sky: ['#14070c', '#4a0f16', '#b8401c'],
      sun: '#ff8a4a',
      glow: '#ff4a1a',
      far: '#12070b',
      mid: '#12070b',
      near: '#12070b',
    },
    light: {
      sky: ['#ffb08a', '#ffcfae', '#ffe6d2'],
      sun: '#fff1e0',
      glow: '#ff8a4a',
      far: '#5a2a2a',
      mid: '#5a2a2a',
      near: '#5a2a2a',
    },
  },
};

let uid = 0;

function illuSvg(kind: IlluKind, dark: boolean, seed: number, W = 320, H = 128): string {
  const p = ILLU[kind][dark ? 'dark' : 'light'];
  const id = `taxz-il${uid++}`;
  const R = rnd(seed + W);
  let g = `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">${p.sky
    .map((c, i) => `<stop offset="${i / (p.sky.length - 1)}" stop-color="${c}"/>`)
    .join(
      '',
    )}</linearGradient><radialGradient id="${id}g"><stop offset="0" stop-color="${p.glow}" stop-opacity=".8"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
  if (p.stars) {
    for (let i = 0; i < W / 7; i++) {
      g += `<circle cx="${(R() * W).toFixed(1)}" cy="${(R() * H * 0.5).toFixed(1)}" r="${(R() * 0.9 + 0.3).toFixed(2)}" fill="#fff" opacity="${(0.3 + R() * 0.6).toFixed(2)}"/>`;
    }
  }
  const city = kind === 'city';
  const sx = W * (city ? 0.5 : 0.7);
  const sy = H * (city ? 0.62 : 0.42);
  g += `<circle cx="${sx}" cy="${sy}" r="${H * 0.7}" fill="url(#${id}g)"/><circle cx="${sx}" cy="${sy}" r="${H * (city ? 0.2 : 0.1)}" fill="${p.sun}"/>`;
  if (city) {
    let x = -6;
    while (x < W) {
      const w = 14 + R() * 26;
      const h = H * (0.22 + R() * 0.38);
      g += `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(w - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${p.near}"/>`;
      for (let wy = H - h + 6; wy < H - 6; wy += 7) {
        for (let wx = x + 3; wx < x + w - 5; wx += 5) {
          if (R() > 0.86) {
            g += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="2" height="3" fill="#ffb347" opacity="${(0.4 + R() * 0.6).toFixed(2)}"/>`;
          }
        }
      }
      x += w;
    }
    g += `<rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#${id}f)"/>`;
  } else {
    g += `<path d="${wave(
      W,
      H,
      H * 0.52,
      [
        [H * 0.1, 2.2, 0],
        [H * 0.05, 5.1, 1],
      ],
      R() * 6,
    )}" fill="${p.far}"/>`;
    g += `<path d="${wave(
      W,
      H,
      H * 0.66,
      [
        [H * 0.07, 1.6, 2],
        [H * 0.03, 4.3, 0],
      ],
      R() * 6,
    )}" fill="${p.mid}"/>`;
    g += `<path d="${wave(
      W,
      H,
      H * 0.8,
      [
        [H * 0.05, 1.2, 1],
        [H * 0.02, 3.7, 2],
      ],
      R() * 6,
    )}" fill="${p.near}"/>`;
    g += `<rect width="${W}" height="${H}" fill="url(#${id}f)"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
}

const iconSvg = (look: GameLook, attrs = '') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${attrs}>${look.icon}</svg>`;

function ImageTile({ image }: { image: string }) {
  return <img className='taxz-art-tile' src={image} alt='' loading='lazy' />;
}

export function ServerArtLayer({
  look,
  art,
  seedText,
  image = null,
}: {
  look: GameLook;
  art: ArtChoice;
  seedText: string;
  image?: string | null;
}) {
  const dark = useComputedColorScheme('dark') === 'dark';
  const [c1, c2, c3] = look.colors;
  const illu = useMemo(
    () => (art === 'illu' ? illuSvg(look.illu, dark, seedOf(seedText)) : ''),
    [art, look.illu, dark, seedText],
  );

  if (art === 'illu') {
    return (
      <div className='taxz-art-layer'>
        <div className='taxz-art-illu' dangerouslySetInnerHTML={{ __html: illu }} />
        {image && <ImageTile image={image} />}
      </div>
    );
  }
  if (art === 'icon') {
    return (
      <div className='taxz-art-layer'>
        <div
          className='taxz-art-mesh'
          style={{
            background: `radial-gradient(70% 120% at 85% 10%, ${c3}aa, transparent 60%), radial-gradient(80% 140% at 10% 100%, ${c1}, transparent 70%), linear-gradient(160deg, ${c2}, ${c1})`,
          }}
        />
        {image ? (
          <div className='taxz-art-amb'>
            <img src={image} alt='' loading='lazy' />
          </div>
        ) : (
          <div
            className='taxz-art-amb'
            dangerouslySetInnerHTML={{ __html: iconSvg(look, 'preserveAspectRatio="xMidYMid slice"') }}
          />
        )}
        <span className='taxz-art-shade' />
        {image && <ImageTile image={image} />}
      </div>
    );
  }
  return (
    <div className='taxz-art-layer'>
      <div
        className='taxz-art-fill'
        style={{
          background: `radial-gradient(80% 130% at 0% 0%, ${c3}99, transparent 60%), radial-gradient(90% 120% at 100% 100%, ${c1}, transparent 65%), linear-gradient(135deg, ${c1}, ${c2})`,
        }}
      />
      <div className='taxz-art-hatch' />
      {image ? (
        <div className='taxz-art-glyph is-img'>
          <img src={image} alt='' loading='lazy' />
        </div>
      ) : (
        <div className='taxz-art-glyph' dangerouslySetInnerHTML={{ __html: iconSvg(look) }} />
      )}
      <span className='taxz-art-shade' />
    </div>
  );
}

export function ServerEmblem({
  look,
  size = 'md',
  style,
  image = null,
}: {
  look: GameLook;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
  image?: string | null;
}) {
  if (image) {
    return (
      <span className={`taxz-emb taxz-emb-${size} is-img`} style={style} aria-hidden='true'>
        <img src={image} alt='' />
      </span>
    );
  }
  return (
    <span
      className={`taxz-emb taxz-emb-${size}`}
      style={{ ...style, color: look.colors[2] }}
      aria-hidden='true'
      dangerouslySetInnerHTML={{ __html: iconSvg(look) }}
    />
  );
}
