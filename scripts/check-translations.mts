// Prueft, ob jede Uebersetzung unter frontend/public/translations/<sprache>/de.taxz.theme.json genau die Schluessel,
// Platzhalter ({name}) und Eintraege (items) der englischen Basis in frontend/src/translations.ts hat.
// Laeuft im Frontend-Ordner des Panels, weil translations.ts das Paket "shared" braucht:
//   cd <panel>/frontend && pnpm exec tsx <theme-repo>/scripts/check-translations.mts <theme-repo>

import fs from 'node:fs/promises';
import path from 'node:path';

type Tree = { [key: string]: string | Tree };

const repo = path.resolve(process.argv[2] ?? '.');
const { default: base } = await import(path.join(repo, 'frontend/src/translations.ts'));

function leaves(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(full, value);
    else for (const [k, v] of leaves(value, full)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');

const english = leaves(base.obj as Tree);
const items = Object.keys(base.items as object).sort();
const dir = path.join(repo, 'frontend/public/translations');
const problems: string[] = [];
let checked = 0;

for (const language of await fs.readdir(dir)) {
  const file = path.join(dir, language, 'de.taxz.theme.json');
  const data = JSON.parse(await fs.readFile(file, 'utf8')) as { items?: object; translations?: Tree };
  const other = leaves(data.translations ?? {});
  checked++;
  for (const [key, text] of english) {
    const translated = other.get(key);
    if (translated === undefined) problems.push(`${language}: missing ${key}`);
    else if (placeholders(text) !== placeholders(translated))
      problems.push(`${language}: placeholders differ in ${key} ({${placeholders(text)}} vs {${placeholders(translated)}})`);
  }
  for (const key of other.keys()) if (!english.has(key)) problems.push(`${language}: unknown key ${key}`);
  const otherItems = Object.keys(data.items ?? {}).sort();
  if (otherItems.join() !== items.join()) problems.push(`${language}: items differ (${otherItems.join()} vs ${items.join()})`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`translations ok: ${english.size} keys, ${items.length} items, ${checked} language(s)`);
