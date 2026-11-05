// Macros Vial (protocole >= 2) : tampon unique, macros séparées par 0x00, actions préfixées par SS_QMK_PREFIX.
// Reproduit vial-gui protocol/macro.py (macro_deserialize_v2, macros_serialize) et macro/macro_action.py.
import type { KeycodeCatalog } from '../keycodes/catalog';

export type MacroAction =
  readonly ['text', string] | readonly ['tap' | 'down' | 'up', ...string[]] | readonly ['delay', number];

export type Macro = readonly MacroAction[];

const SS_QMK_PREFIX = 1;
const SS_TAP = 1;
const SS_DOWN = 2;
const SS_UP = 3;
const SS_DELAY = 4;
const EXT_TAP = 5;
const EXT_DOWN = 6;
const EXT_UP = 7;

const TAGS: Readonly<Record<number, 'tap' | 'down' | 'up'>> = {
  [SS_TAP]: 'tap',
  [SS_DOWN]: 'down',
  [SS_UP]: 'up',
};
const EXT_REMAP: Readonly<Record<number, number>> = {
  [EXT_TAP]: SS_TAP,
  [EXT_DOWN]: SS_DOWN,
  [EXT_UP]: SS_UP,
};

/** Découpe le tampon en exactement `count` macros brutes (comme reload_macros_late + macros_deserialize). */
export function splitMacroBuffer(buffer: Uint8Array, count: number): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < buffer.length && parts.length < count; i++) {
    if (buffer[i] === 0) {
      parts.push(buffer.slice(start, i));
      start = i + 1;
    }
  }
  if (parts.length < count && start < buffer.length) parts.push(buffer.slice(start));
  while (parts.length < count) parts.push(new Uint8Array(0));
  return parts;
}

type Step =
  | { kind: 'text'; text: string }
  | { kind: 'seq'; act: number; codes: number[] }
  | { kind: 'delay'; ms: number };

export function deserializeMacro(data: Uint8Array, catalog: KeycodeCatalog): Macro {
  const steps: Step[] = [];
  let i = 0;
  while (i < data.length) {
    const byte = data[i] ?? 0;
    if (byte !== SS_QMK_PREFIX) {
      // octet brut = caractère (chr() de Python : Latin-1)
      const last = steps.at(-1);
      const ch = String.fromCharCode(byte);
      if (last?.kind === 'text') last.text += ch;
      else steps.push({ kind: 'text', text: ch });
      i++;
      continue;
    }
    if (i + 1 >= data.length) break;
    let act = data[i + 1] ?? 0;
    if (act in TAGS || act in EXT_REMAP) {
      let code: number;
      let length: number;
      if (act in TAGS) {
        if (i + 2 >= data.length) break;
        code = data[i + 2] ?? 0;
        length = 3;
      } else {
        act = EXT_REMAP[act] ?? act;
        if (i + 3 >= data.length) break;
        code = (data[i + 2] ?? 0) | ((data[i + 3] ?? 0) << 8);
        // decode_keycode() de QMK : 0xFFxx code un keycode dont l'octet bas est nul
        if (code > 0xff00) code = (code & 0xff) << 8;
        length = 4;
      }
      const last = steps.at(-1);
      if (last?.kind === 'seq' && last.act === act) last.codes.push(code);
      else steps.push({ kind: 'seq', act, codes: [code] });
      i += length;
    } else if (act === SS_DELAY) {
      if (i + 3 >= data.length) break;
      steps.push({ kind: 'delay', ms: (data[i + 2] ?? 1) - 1 + ((data[i + 3] ?? 1) - 1) * 255 });
      i += 4;
    } else {
      // action inconnue : on saute deux octets, comme Vial
      i += 2;
    }
  }
  return steps.map((step): MacroAction => {
    if (step.kind === 'text') return ['text', step.text];
    if (step.kind === 'delay') return ['delay', step.ms];
    return [TAGS[step.act] ?? 'tap', ...step.codes.map((code) => catalog.serialize(code))];
  });
}

export function deserializeMacros(buffer: Uint8Array, count: number, catalog: KeycodeCatalog): Macro[] {
  return splitMacroBuffer(buffer, count).map((data) => deserializeMacro(data, catalog));
}

export class MacroError extends Error {
  override readonly name = 'MacroError';
}

function serializeAction(action: MacroAction, catalog: KeycodeCatalog): number[] {
  const [tag, ...args] = action;
  // données venues d'un fichier : on ne se fie pas au typage
  const first: unknown = args[0];
  if (tag === 'text') return [...new TextEncoder().encode(typeof first === 'string' ? first : '')];
  if (tag === 'delay') {
    const ms = typeof first === 'number' ? first : 0;
    return [SS_QMK_PREFIX, SS_DELAY, (ms % 255) + 1, Math.floor(ms / 255) + 1];
  }
  const out: number[] = [];
  for (const name of args) {
    let code = catalog.deserialize(String(name));
    out.push(SS_QMK_PREFIX);
    const base = tag === 'tap' ? SS_TAP : tag === 'down' ? SS_DOWN : SS_UP;
    if (code < 256) {
      out.push(base, code);
    } else {
      out.push(base + 4);
      if (code % 256 === 0) code = 0xff00 | (code >> 8);
      out.push(code & 0xff, code >> 8);
    }
  }
  return out;
}

/** Tampon complet : `count` macros (complétées ou tronquées) séparées et terminées par 0x00. */
export function serializeMacros(
  macros: readonly Macro[],
  count: number,
  catalog: KeycodeCatalog,
): Uint8Array {
  const list = [...macros.slice(0, count)];
  while (list.length < count) list.push([]);
  const bytes: number[] = [];
  for (const macro of list) {
    for (const action of macro) {
      if (!['text', 'tap', 'down', 'up', 'delay'].includes(action[0])) continue;
      bytes.push(...serializeAction(action, catalog));
    }
    bytes.push(0);
  }
  return Uint8Array.from(bytes);
}

/** Forme normalisée du tampon lu (count macros + 0x00), pour comparer avec un import. */
export function normalizeMacroBuffer(buffer: Uint8Array, count: number): Uint8Array {
  const parts = splitMacroBuffer(buffer, count);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length + 1, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length + 1;
  }
  return out;
}
