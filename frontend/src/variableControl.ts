// Steuerelement einer Egg-Variable aus ihren Regeln (Designvorgabe 9.12, Idee 16). Spielneutral: es zaehlen nur die
// Regeln, die das Panel fuer jede Variable kennt (Laravel-Schreibweise wie im Egg):
//   boolean bzw. in:0,1 / in:true,false  -> Schalter
//   in:a,b,c                             -> Segment (bis 4 kurze Werte), sonst Auswahl
//   integer|numeric mit between:a,b      -> Schieberegler mit Zahl (ebenso mit min:a und max:b)
//   integer|numeric ohne Bereich         -> Zahlenfeld
//   geheim                               -> Passwortfeld
//   sonst                                -> Textfeld

export type VariableControl =
  | { type: 'switch'; on: string; off: string }
  | { type: 'segment'; options: string[] }
  | { type: 'select'; options: string[] }
  | { type: 'range'; min: number; max: number; step: number }
  | { type: 'number'; min?: number; max?: number; integer: boolean }
  | { type: 'secret' }
  | { type: 'text' };

const NUMERIC = ['integer', 'int', 'numeric', 'num'];
const SEGMENT_MAX = 4;
const SEGMENT_LABEL_MAX = 14;

function ruleArgs(rules: string[], name: string): string[] | null {
  const rule = rules.find((r) => r.startsWith(`${name}:`));
  return rule ? rule.slice(name.length + 1).split(',') : null;
}

function num(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function variableControl(variable: { rules: string[]; isSecret: boolean; value: string }): VariableControl {
  const { rules } = variable;
  const options = ruleArgs(rules, 'in');

  const pair = options ? [...options].sort().join(',') : null;
  if (rules.includes('boolean') || pair === '0,1' || pair === 'false,true') {
    // Schreibweise beibehalten: true/false, wenn die Regel oder der aktuelle Wert sie nutzt
    const words = pair === 'false,true' || (pair === null && /^(true|false)$/i.test(variable.value));
    return words ? { type: 'switch', on: 'true', off: 'false' } : { type: 'switch', on: '1', off: '0' };
  }

  if (options) {
    const short = options.length <= SEGMENT_MAX && options.every((o) => o.length <= SEGMENT_LABEL_MAX);
    return short ? { type: 'segment', options } : { type: 'select', options };
  }

  if (rules.some((rule) => NUMERIC.includes(rule))) {
    const integer = rules.includes('integer') || rules.includes('int');
    const between = ruleArgs(rules, 'between');
    const min = num(between?.[0] ?? ruleArgs(rules, 'min')?.[0]);
    const max = num(between?.[1] ?? ruleArgs(rules, 'max')?.[0]);
    if (min !== undefined && max !== undefined && max > min) {
      const step = integer ? 1 : Math.max((max - min) / 100, Number.EPSILON);
      return { type: 'range', min, max, step };
    }
    return { type: 'number', min, max, integer };
  }

  if (variable.isSecret) return { type: 'secret' };
  return { type: 'text' };
}
