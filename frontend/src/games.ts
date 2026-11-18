// Spiel eines Servers fuer Farben, Symbol und Illustration (Designvorgabe 5.). Erkannt wird nur am Egg (Name, Docker-Image),
// das gibt es fuer jeden Server. Spiele ohne eigenen Eintrag bekommen Farben aus einem Hash des Egg-Namens und ein neutrales
// Symbol, damit jeder Server gleich behandelt wird (Regel 1.2). Spielbezogen sind hier nur Farben und Symbol.

export type IlluKind = 'meadow' | 'night' | 'city' | 'dunes' | 'snow';

export interface GameLook {
  key: string;
  /** Etikett auf dem Kartenkopf */
  label: string;
  /** Hauptfarbe, Grundton (dunkel), Lichtfarbe */
  colors: [string, string, string];
  icon: string;
  illu: IlluKind;
}

interface GameEntry extends Omit<GameLook, 'label'> {
  label: string;
  match: RegExp;
}

// Symbole als SVG-Inhalt fuer viewBox 0 0 24 24 (eigene, schlichte Formen, keine Markenlogos).
const ICON = {
  block:
    '<g shape-rendering="crispEdges"><rect x="3" y="3" width="18" height="18" fill="#7a5233"/><rect x="3" y="3" width="18" height="6" fill="#4caf50"/><rect x="3" y="9" width="4" height="2" fill="#4caf50"/><rect x="11" y="9" width="3" height="3" fill="#4caf50"/><rect x="17" y="9" width="4" height="2" fill="#4caf50"/><rect x="6" y="15" width="3" height="3" fill="#5e3f27"/><rect x="14" y="14" width="3" height="3" fill="#5e3f27"/><rect x="5" y="4" width="3" height="2" fill="#6fd06f"/><rect x="14" y="5" width="4" height="2" fill="#6fd06f"/></g>',
  shield:
    '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="#b2392c"/><path d="M8.5 9h7M8.5 12.5h7M10 16h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  axe: '<path d="M7 21 16.5 6.5" stroke="#8a6a4a" stroke-width="2.2" stroke-linecap="round"/><path d="M13 4.5c3.2-1.6 6.8-.6 8 1.8-2.7.1-4.6 1.3-5.6 3.5z" fill="#c9d3dd"/><path d="M13 4.5c-.8 2.2.1 4 2.4 5.3" stroke="#7f8b97" stroke-width="1.2" fill="none"/>',
  tree: '<circle cx="12" cy="9" r="6.5" fill="#3f9d4a"/><circle cx="8.5" cy="11" r="4" fill="#2f7d3a"/><circle cx="15.5" cy="11.5" r="3.6" fill="#55b85f"/><rect x="10.8" y="13" width="2.4" height="8" rx="1" fill="#7a5233"/>',
  gear: '<path d="M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" fill="none" stroke="#d9a35b" stroke-width="2.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="#d9a35b" stroke-width="2.4" stroke-linecap="round"/>',
  sun: '<circle cx="12" cy="12" r="5" fill="#ffb347"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#ffb347" stroke-width="2" stroke-linecap="round"/>',
  flake:
    '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" stroke="#bfe3ff" stroke-width="2" stroke-linecap="round"/><path d="m9.5 3.8 2.5 2 2.5-2M9.5 20.2l2.5-2 2.5 2" stroke="#bfe3ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  biohazard: '<path fill-rule="evenodd" fill="#e8552a" d="M18.6 6.7 18.0 5.1 16.9 3.6 15.6 2.5 14.2 1.9 12.4 1.5 10.9 1.6 9.2 2.1 7.7 3.0 6.9 3.8 6.3 4.7 5.6 6.1 5.3 7.6 4.4 8.8 3.8 10.2 2.8 11.1 2.1 11.9 1.7 12.7 1.3 13.7 1.0 15.5 1.1 17.0 1.6 18.5 2.5 20.0 3.4 20.9 4.5 21.6 6.0 22.2 7.3 22.4 8.8 22.3 10.5 21.8 12.0 22.0 13.5 21.8 15.2 22.3 16.9 22.4 18.0 22.2 18.9 21.9 19.7 21.5 20.6 20.9 21.6 19.8 22.5 18.3 23.0 16.6 23.0 14.8 22.7 13.5 22.2 12.5 21.4 11.2 20.2 10.2 19.6 8.8 18.7 7.6zM3.5 12.6 4.8 12.1 5.5 11.9 6.3 11.9 6.9 12.7 7.7 13.5 8.6 14.1 9.6 14.6 9.5 15.7 9.6 16.8 9.9 17.8 10.3 18.8 9.6 19.8 8.8 20.5 8.0 20.9 7.1 21.2 6.2 21.3 5.2 21.2 4.3 20.9 3.5 20.5 2.8 19.9 2.2 19.2 1.8 18.4 1.5 17.5 1.4 16.6 1.5 15.7 1.8 14.8 2.2 13.9 2.8 13.2zM14.4 14.6 15.8 13.9 16.5 13.3 17.1 12.7 17.7 11.9 18.5 11.9 19.2 12.1 19.9 12.3 20.6 12.7 21.3 13.3 21.9 14.1 22.3 14.9 22.5 15.8 22.6 16.7 22.4 17.6 22.1 18.5 21.7 19.3 21.1 20.0 20.3 20.6 19.5 21.0 18.6 21.2 17.7 21.3 16.8 21.2 15.9 20.9 15.1 20.4 14.3 19.7 13.7 18.8 14.1 17.8 14.4 16.8 14.5 15.7zM16.7 7.2 16.4 8.1 16.0 8.9 15.0 9.1 13.9 9.4 12.9 9.8 12.0 10.5 11.1 9.8 10.1 9.4 9.0 9.1 8.0 8.9 7.6 8.1 7.4 7.4 7.3 6.4 7.3 5.7 7.6 4.8 8.0 4.0 8.6 3.2 9.2 2.6 10.0 2.1 10.9 1.8 11.8 1.7 12.8 1.8 13.7 2.0 14.5 2.4 15.2 3.0 15.8 3.7 16.3 4.5 16.6 5.4 16.7 6.3zM13.3 13.3 13.2 13.7 13.0 14.1 12.8 14.3 12.4 14.5 12.4 16.9 12.2 17.1 11.9 17.1 11.6 16.8 11.6 14.5 11.2 14.3 10.8 13.9 10.7 13.4 10.7 12.9 8.7 11.7 8.5 11.5 8.6 11.3 8.7 11.1 9.0 11.1 11.1 12.2 11.5 12.0 12.0 11.8 12.5 12.0 12.9 12.2 15.0 11.1 15.2 11.0 15.4 11.1 15.5 11.4 15.4 11.6 13.3 12.9z"/>',
  server:
    '<rect x="4" y="4" width="16" height="6.5" rx="1.8" fill="currentColor" opacity=".9"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.8" fill="currentColor" opacity=".9"/><circle cx="7.5" cy="7.2" r="1.1" fill="#5ddf98"/><circle cx="7.5" cy="16.8" r="1.1" fill="#5ddf98"/><path d="M11 7.2h6M11 16.8h6" stroke="rgba(0,0,0,.35)" stroke-width="1.4" stroke-linecap="round"/>',
};

const GAMES: GameEntry[] = [
  {
    key: 'minecraft',
    label: 'Minecraft',
    match:
      /minecraft|paper|purpur|spigot|bukkit|folia|fabric|forge|neoforge|quilt|velocity|bungee|waterfall|bedrock|nukkit|pocketmine|geyser|sponge|mohist|arclight|leaf\b/i,
    colors: ['#2f8f46', '#3a2614', '#7fe08a'],
    icon: ICON.block,
    illu: 'meadow',
  },
  {
    key: 'l4d',
    label: 'Left 4 Dead',
    match: /left ?4 ?dead|l4d/i,
    colors: ['#b2392c', '#2a0b12', '#ff9a5a'],
    icon: ICON.biohazard,
    illu: 'city',
  },
  {
    key: 'source',
    label: 'Source',
    match:
      /counter[- ]?strike|cs ?2|csgo|cs:go|garry|gmod|team ?fortress|tf2|half[- ]?life|srcds|source engine|insurgency|day of defeat|black mesa|no more room in hell/i,
    colors: ['#b2392c', '#2a0b12', '#ff9a5a'],
    icon: ICON.shield,
    illu: 'city',
  },
  {
    key: 'valheim',
    label: 'Valheim',
    match: /valheim/i,
    colors: ['#3d6b8c', '#0f1a26', '#9cc9e6'],
    icon: ICON.axe,
    illu: 'night',
  },
  {
    key: 'terraria',
    label: 'Terraria',
    match: /terraria|tmodloader|tshock/i,
    colors: ['#3f9d4a', '#13261a', '#b8f07a'],
    icon: ICON.tree,
    illu: 'meadow',
  },
  {
    key: 'factory',
    label: 'Factory',
    match: /factorio|satisfactory|space ?engineers|astroneer/i,
    colors: ['#c27b2a', '#2a1a0c', '#ffd28a'],
    icon: ICON.gear,
    illu: 'dunes',
  },
  {
    key: 'survival',
    label: 'Survival',
    match: /\brust\b|\bark\b|conan|7 ?days|seven days|project ?zomboid|zomboid|palworld|dayz|unturned|v ?rising|enshrouded|sons of the forest|the forest/i,
    colors: ['#a35a2c', '#22140c', '#ffb37a'],
    icon: ICON.sun,
    illu: 'dunes',
  },
  {
    key: 'winter',
    label: 'Winter',
    match: /don'?t starve|core ?keeper|stardew|snow/i,
    colors: ['#5a7fb0', '#121a2a', '#cfe4ff'],
    icon: ICON.flake,
    illu: 'snow',
  },
];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h: number, s: number, l: number): string {
  // als Hex, damit Verlaeufe mit angehaengter Deckkraft ("…aa") funktionieren
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const cache = new Map<string, GameLook>();

export interface EggLike {
  name: string;
  dockerImages?: Record<string, string>;
}

export function gameLook(egg: EggLike | null | undefined): GameLook {
  const name = egg?.name?.trim() || 'Server';
  const images = Object.values(egg?.dockerImages ?? {}).join(' ');
  const id = `${name}|${images}`;
  const known = cache.get(id);
  if (known) return known;

  const hit = GAMES.find((game) => game.match.test(name)) ?? GAMES.find((game) => images && game.match.test(images));
  let look: GameLook;
  if (hit) {
    // Minecraft und Source als Spielname, sonst der Egg-Name, der ist beim Rest genauer
    const label = hit.key === 'minecraft' ? 'Minecraft' : hit.key === 'source' ? 'Source' : name;
    look = { key: hit.key, label, colors: hit.colors, icon: hit.icon, illu: hit.illu };
  } else {
    const h = hash(name.toLowerCase()) % 360;
    look = {
      key: `egg-${h}`,
      label: name,
      colors: [hsl(h, 0.55, 0.42), hsl((h + 20) % 360, 0.45, 0.12), hsl((h + 40) % 360, 0.85, 0.72)],
      icon: ICON.server,
      illu: (['meadow', 'night', 'dunes', 'snow'] as IlluKind[])[h % 4],
    };
  }
  cache.set(id, look);
  return look;
}

export function seedOf(text: string): number {
  return hash(text);
}
