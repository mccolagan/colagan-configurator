#!/usr/bin/env node
// Génère src/keycodes/vial-v6.generated.ts à partir des sources de Vial, lues comme du TEXTE (jamais exécutées) :
//   - vial-gui  src/main/python/keycodes/keycodes_v6.py : nom Vial -> valeur (protocole 6)
//   - vial-gui  src/main/python/keycodes/keycodes.py    : listes K(...) (ordre, libellés, alias, masqués)
//   - vial-qmk  quantum/vialrgb_effects.inc             : identifiants des effets VialRGB
// Usage : node scripts/gen-keycodes.mjs <vial-gui> <vial-qmk>   (voir `make keycodes`)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [vialGui, vialQmk] = process.argv.slice(2);
if (!vialGui || !vialQmk) {
  console.error('Usage : gen-keycodes.mjs <vial-gui> <vial-qmk>');
  process.exit(1);
}
const keycodesDir = join(vialGui, 'src/main/python/keycodes');

// --- keycodes_v6.py : entrées "NOM": 0x1234 ---------------------------------------------------------------
const v6Source = readFileSync(join(keycodesDir, 'keycodes_v6.py'), 'utf8');
const values = {};
for (const match of v6Source.matchAll(/^\s+"([^"]+)":\s*(0x[0-9A-Fa-f]+|\d+),/gm)) {
  values[match[1]] = Number(match[2]);
}

// --- keycodes.py : listes de K(...) -----------------------------------------------------------------------
const kSource = readFileSync(join(keycodesDir, 'keycodes.py'), 'utf8');

/** Lit un littéral chaîne Python à la position i ; renvoie [valeur, fin]. */
function readString(src, i) {
  const quote = src[i];
  let out = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') {
      const n = src[j + 1];
      const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
      if (n === 'u') {
        out += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16));
        j += 5;
      } else {
        out += map[n] ?? n;
        j += 1;
      }
    } else if (c === quote) {
      return [out, j + 1];
    } else {
      out += c;
    }
  }
  throw new Error(`Chaîne non terminée à ${i}`);
}

/** Découpe les arguments d'un appel K(...) commençant après la parenthèse ouvrante. */
function readCall(src, i) {
  const args = [];
  let current = '';
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '"' || c === "'") {
      const [, end] = readString(src, j);
      current += src.slice(j, end);
      j = end - 1;
    } else if (c === '(' || c === '[') {
      depth++;
      current += c;
    } else if (c === ']' || (c === ')' && depth > 0)) {
      depth--;
      current += c;
    } else if (c === ')') {
      if (current.trim()) args.push(current.trim());
      return [args, j + 1];
    } else if (c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  throw new Error(`Appel non terminé à ${i}`);
}

function parseLiteral(text) {
  if (text.startsWith('"') || text.startsWith("'")) {
    const [value, end] = readString(text, 0);
    if (end !== text.length) throw new Error(`Littéral inattendu : ${text}`);
    return value;
  }
  if (text.startsWith('[')) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    const [items] = readCall(`${inner})`, 0);
    return items.map(parseLiteral);
  }
  if (text === 'True') return true;
  if (text === 'False') return false;
  if (text === 'None') return null;
  throw new Error(`Littéral non géré : ${text}`);
}

function parseK(args) {
  const positional = [];
  const keywords = {};
  for (const arg of args) {
    const kw = /^([a-z_]+)\s*=\s*([\s\S]+)$/.exec(arg);
    if (kw) keywords[kw[1]] = parseLiteral(kw[2]);
    else positional.push(parseLiteral(arg));
  }
  const [id, label, tooltip] = positional;
  const entry = { id, label };
  const tip = tooltip ?? keywords.tooltip;
  if (tip) entry.tooltip = tip;
  if (keywords.alias?.length) entry.aliases = keywords.alias;
  if (keywords.masked) entry.masked = true;
  if (keywords.requires_feature) entry.feature = keywords.requires_feature;
  return entry;
}

function readList(name) {
  const start = kSource.indexOf(`\n${name} = [`);
  if (start < 0) throw new Error(`Liste ${name} introuvable`);
  const end = kSource.indexOf('\n]', start);
  const body = kSource.slice(start, end);
  const entries = [];
  for (let i = body.indexOf('K('); i >= 0; i = body.indexOf('K(', i)) {
    if (/\w/.test(body[i - 1] ?? '')) {
      i += 2;
      continue;
    }
    const [args, next] = readCall(body, i + 2);
    entries.push(parseK(args));
    i = next;
  }
  return entries;
}

// Ordre et composition de recreate_keycodes() ; KEYCODES_BASIC est étendu par NUMPAD puis NAV.
const groups = {
  special: readList('KEYCODES_SPECIAL'),
  basic: [
    ...readList('KEYCODES_BASIC'),
    ...readList('KEYCODES_BASIC_NUMPAD'),
    ...readList('KEYCODES_BASIC_NAV'),
  ],
  shifted: readList('KEYCODES_SHIFTED'),
  iso: readList('KEYCODES_ISO'),
  boot: readList('KEYCODES_BOOT'),
  modifiers: readList('KEYCODES_MODIFIERS'),
  quantum: readList('KEYCODES_QUANTUM'),
  backlight: readList('KEYCODES_BACKLIGHT'),
  media: readList('KEYCODES_MEDIA'),
  macroBase: readList('KEYCODES_MACRO_BASE'),
  midiBasic: readList('KEYCODES_MIDI_BASIC'),
  midiAdvanced: readList('KEYCODES_MIDI_ADVANCED'),
};

const unresolved = Object.values(groups)
  .flat()
  .filter((e) => !(e.id in values))
  .map((e) => e.id);

// --- vialrgb_effects.inc : enum VIALRGB_EFFECT_* -----------------------------------------------------------
const rgbSource = readFileSync(join(vialQmk, 'quantum/vialrgb_effects.inc'), 'utf8');
const enumBody = rgbSource.slice(rgbSource.indexOf('enum {'), rgbSource.indexOf('};'));
const rgbEffects = [...enumBody.matchAll(/VIALRGB_EFFECT_([A-Z0-9_]+)/g)].map((m, index) => ({
  id: index,
  name: m[1],
}));

// --- sortie -------------------------------------------------------------------------------------------------
const header = `// FICHIER GÉNÉRÉ par scripts/gen-keycodes.mjs — ne pas modifier à la main.
// Sources : vial-gui (keycodes_v6.py, keycodes.py), vial-qmk (quantum/vialrgb_effects.inc).
`;
const body = `${header}
export interface VialKeycodeDef {
  readonly id: string;
  readonly label: string;
  readonly tooltip?: string;
  readonly aliases?: readonly string[];
  readonly masked?: boolean;
  readonly feature?: string;
}

/** Nom Vial -> valeur (protocole 6), hors formes calculées (MO(n), M0, TD(n), USERnn, LTn(kc)…). */
export const VIAL_V6_VALUES: Readonly<Record<string, number>> = ${JSON.stringify(values, null, 2)};

/** Listes de keycodes de l'interface Vial, dans l'ordre de recreate_keycodes(). */
export const VIAL_GROUPS = ${JSON.stringify(groups, null, 2)} as const satisfies Record<string, readonly VialKeycodeDef[]>;

/** Identifiants VialRGB (≠ numéros d'effets QMK). */
export const VIALRGB_EFFECTS: readonly { readonly id: number; readonly name: string }[] = ${JSON.stringify(rgbEffects, null, 2)};
`;
writeFileSync('src/keycodes/vial-v6.generated.ts', body);
console.log(
  `${Object.keys(values).length} valeurs, ${Object.values(groups).flat().length} keycodes listés, ` +
    `${rgbEffects.length} effets VialRGB` +
    (unresolved.length ? ` ; sans valeur v6 : ${unresolved.join(', ')}` : ''),
);
