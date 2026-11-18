// Datei-Editor im Konsolen-Look, immer dunkel (Designvorgabe 7.4): Im taxz-Theme bekommt der Monaco-Editor auch im
// hellen Modus das dunkle Schema. Monaco kennt nur ein globales Schema; das Panel setzt es beim Wechsel Hell/Dunkel neu,
// daher wird es danach erneut auf Dunkel gestellt. Mit "Standard" bleibt alles beim Panel.

import type { ExtensionContext } from 'shared';
import { getLoadedMonacoOrNull } from '@/lib/editor/monacoLoader.ts';
import { isTaxzActive } from './prefs.ts';

function forceDark() {
  if (!isTaxzActive()) return;
  getLoadedMonacoOrNull()?.editor.setTheme('vs-dark');
}

export function registerEditorDark(ctx: ExtensionContext) {
  ctx.extensionRegistry.enterElements((elements) => {
    elements.monacoEditor.addOnMountHandler(() => forceDark());
    elements.monacoEditor.addDiffOnMountHandler(() => forceDark());
  });

  // Nach einem Wechsel von Modus oder Theme setzt das Panel das Editor-Schema neu; danach wieder dunkel (kurz danach, wenn das Panel sein Schema gesetzt hat).
  const observer = new MutationObserver(() => {
    window.setTimeout(() => {
      if (isTaxzActive()) forceDark();
      else {
        const scheme = document.documentElement.getAttribute('data-mantine-color-scheme');
        getLoadedMonacoOrNull()?.editor.setTheme(scheme === 'light' ? 'vs' : 'vs-dark');
      }
    }, 80);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mantine-color-scheme', 'data-taxz'] });
}
