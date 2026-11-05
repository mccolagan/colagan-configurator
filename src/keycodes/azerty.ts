// Caractères produits par chaque touche HID quand l'OS est en AZERTY FR (disposition PC française).
// Indexé par usage HID (= keycode QMK de base), pour ne pas dépendre des noms Vial historiques.
// Les entrées de SYMBOLS priment sur les lettres (KC_M donne « , » en AZERTY).

export interface KeyChars {
  readonly base: string;
  readonly shift?: string;
  readonly altgr?: string;
}

const LETTERS = 'qbcdefghijklmnoparstuvzxyw';

const SYMBOLS: Readonly<Record<number, KeyChars>> = {
  0x1e: { base: '&', shift: '1' },
  0x1f: { base: 'é', shift: '2', altgr: '~' },
  0x20: { base: '"', shift: '3', altgr: '#' },
  0x21: { base: "'", shift: '4', altgr: '{' },
  0x22: { base: '(', shift: '5', altgr: '[' },
  0x23: { base: '-', shift: '6', altgr: '|' },
  0x24: { base: 'è', shift: '7', altgr: '`' },
  0x25: { base: '_', shift: '8', altgr: '\\' },
  0x26: { base: 'ç', shift: '9', altgr: '^' },
  0x27: { base: 'à', shift: '0', altgr: '@' },
  0x2d: { base: ')', shift: '°', altgr: ']' },
  0x2e: { base: '=', shift: '+', altgr: '}' },
  0x2f: { base: '^', shift: '¨' },
  0x30: { base: '$', shift: '£', altgr: '¤' },
  0x31: { base: '*', shift: 'µ' },
  0x32: { base: '*', shift: 'µ' },
  0x10: { base: ',', shift: '?' },
  0x33: { base: 'm', shift: 'M' },
  0x34: { base: 'ù', shift: '%' },
  0x35: { base: '²' },
  0x36: { base: ';', shift: '.' },
  0x37: { base: ':', shift: '/' },
  0x38: { base: '!', shift: '§' },
  0x64: { base: '<', shift: '>' },
};

const TABLE: ReadonlyMap<number, KeyChars> = new Map<number, KeyChars>([
  ...Array.from(LETTERS).map((letter, i): [number, KeyChars] => [
    0x04 + i,
    letter === 'e' ? { base: 'e', shift: 'E', altgr: '€' } : { base: letter, shift: letter.toUpperCase() },
  ]),
  ...Object.entries(SYMBOLS).map(([code, chars]): [number, KeyChars] => [Number(code), chars]),
]);

export function azertyChars(code: number): KeyChars | undefined {
  return TABLE.get(code);
}

/** Caractères AZERTY d'un keycode, Shift et AltGr compris (LSFT(kc), RALT(kc)). */
export function azertyOutput(code: number): string | undefined {
  const outer = code & 0xff00;
  const chars = TABLE.get(code & 0xff);
  if (!chars) return undefined;
  if (outer === 0) return chars.base;
  if (outer === 0x0200 || outer === 0x1200) return chars.shift;
  if (outer === 0x1400) return chars.altgr;
  return undefined;
}
