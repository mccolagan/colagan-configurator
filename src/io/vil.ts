// Fichier .vil de Vial : JSON écrit par Python json.dumps() (séparateurs ", " et ": ", non-ASCII échappé,
// une seule ligne). L'uid (u64) dépasse 2^53 : il est lu et réécrit en BigInt pour rester exact.

export type VilKeycode = string | -1;

export interface VilKeyOverride {
  trigger: string;
  replacement: string;
  layers: number;
  trigger_mods: number;
  negative_mod_mask: number;
  suppressed_mods: number;
  options: number;
}

export interface VilAltRepeatKey {
  keycode: string;
  alt_keycode: string;
  allowed_mods: number;
  options: number;
}

export interface VilFile {
  version: number;
  uid: bigint;
  layout: VilKeycode[][][];
  encoder_layout: unknown[];
  layout_options: number;
  macro: unknown[][];
  vial_protocol: number;
  via_protocol: number;
  tap_dance: [string, string, string, string, number][];
  combo: [string, string, string, string, string][];
  key_override: VilKeyOverride[];
  alt_repeat_key: VilAltRepeatKey[];
  settings: Record<string, number>;
  [key: string]: unknown;
}

export class VilFormatError extends Error {
  override readonly name = 'VilFormatError';
}

interface ReviverContext {
  source?: string;
}

/** Lit un .vil ; les entiers hors plage sûre deviennent des BigInt (lecture de la source exacte). */
export function parseVil(text: string): VilFile {
  const reviver = function (this: unknown, _key: string, value: unknown, context?: ReviverContext): unknown {
    if (typeof value === 'number' && !Number.isSafeInteger(value) && Number.isInteger(value)) {
      if (!context?.source) throw new VilFormatError('Navigateur trop ancien pour lire l’uid sans perte');
      return BigInt(context.source);
    }
    return value;
  };
  let data: unknown;
  try {
    data = JSON.parse(text, reviver);
  } catch (error) {
    if (error instanceof VilFormatError) throw error;
    throw new VilFormatError(`Fichier .vil illisible : ${(error as Error).message}`);
  }
  if (typeof data !== 'object' || data === null || !('layout' in data) || !('uid' in data)) {
    throw new VilFormatError('Ce fichier n’est pas un .vil (layout ou uid absent)');
  }
  const file = data as VilFile;
  if (typeof file.uid === 'number') file.uid = BigInt(file.uid);
  return file;
}

function escapeString(value: string): string {
  let out = '"';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '"') out += '\\"';
    else if (char === '\\') out += '\\\\';
    else if (char === '\n') out += '\\n';
    else if (char === '\r') out += '\\r';
    else if (char === '\t') out += '\\t';
    else if (char === '\b') out += '\\b';
    else if (char === '\f') out += '\\f';
    else if (code < 0x20 || code > 0x7f) {
      // ensure_ascii : \uXXXX en minuscules, paires de substitution au-delà du plan de base
      const units =
        code > 0xffff ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)] : [code];
      out += units.map((u) => `\\u${u.toString(16).padStart(4, '0')}`).join('');
    } else out += char;
  }
  return `${out}"`;
}

/** Sérialise comme Python json.dumps(obj) par défaut. */
export function stringifyPythonJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new VilFormatError('Nombre non fini');
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return escapeString(value);
  if (Array.isArray(value)) return `[${value.map(stringifyPythonJson).join(', ')}]`;
  if (typeof value === 'object') {
    const parts = Object.entries(value).map(([k, v]) => `${escapeString(k)}: ${stringifyPythonJson(v)}`);
    return `{${parts.join(', ')}}`;
  }
  throw new VilFormatError(`Type non sérialisable : ${typeof value}`);
}

export function stringifyVil(file: VilFile): string {
  return stringifyPythonJson(file);
}
