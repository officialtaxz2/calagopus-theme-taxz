// Code-Vorschau und Editor "Pierre" immer dunkel (Designvorgabe 7.4), wie der Monaco-Editor (editorDark.ts).
// Pierre waehlt sein Farbschema ueber Mantines useComputedColorScheme. Im taxz-Theme bekommt es deshalb einen Mantine-Kontext,
// der "dunkel" meldet; der Rest der Seite bleibt hell. Mit "Standard" rendert das Original unveraendert.
// Diese Datei ersetzt das ganze Modul '@/elements/editors/PierreEditor.tsx' und reicht darum alle Exporte weiter.

import { MantineContext, useMantineContext } from '@mantine/core';
import { type ReactNode, useMemo } from 'react';
import OriginalPierreEditor, {
  PierreDiffEditor as OriginalPierreDiffEditor,
  type PierreDiffEditorProps,
  type PierreEditorProps,
} from '@/elements/editors/PierreEditor.tsx';
import { useIsTaxz } from './prefs.ts';

export type {
  PierreCaret,
  PierreCaretMetadata,
  PierreDiffEditorProps,
  PierreDiffOnMount,
  PierreEditorHandle,
  PierreEditorProps,
  PierreFileChangeEvent,
  PierreFileEditor,
  PierreLocalSelection,
  PierreOnMount,
} from '@/elements/editors/PierreEditor.tsx';

function AlwaysDark({ children }: { children: ReactNode }) {
  const isTaxz = useIsTaxz();
  const context = useMantineContext();
  const dark = useMemo(() => ({ ...context, colorScheme: 'dark' as const }), [context]);
  if (!isTaxz) return children;
  return <MantineContext value={dark}>{children}</MantineContext>;
}

export function PierreEditor(props: PierreEditorProps) {
  return (
    <AlwaysDark>
      <OriginalPierreEditor {...props} />
    </AlwaysDark>
  );
}

export function PierreDiffEditor(props: PierreDiffEditorProps) {
  return (
    <AlwaysDark>
      <OriginalPierreDiffEditor {...props} />
    </AlwaysDark>
  );
}

export default PierreEditor;
