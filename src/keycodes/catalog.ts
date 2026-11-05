// Catalogue des keycodes d'un clavier, construit comme vial-gui (recreate_keyboard_keycodes) pour que la
// sérialisation valeur <-> nom soit identique à celle de Vial (fichiers .vil interchangeables).
import { KeycodeExpression } from './expression';
import { VIAL_GROUPS, VIAL_V6_VALUES, type VialKeycodeDef } from './vial-v6.generated';

export type KeycodeGroup =
  | 'special'
  | 'basic'
  | 'shifted'
  | 'iso'
  | 'layers'
  | 'boot'
  | 'modifiers'
  | 'quantum'
  | 'backlight'
  | 'media'
  | 'tapDance'
  | 'macro'
  | 'user'
  | 'hidden'
  | 'midi';

export interface KeycodeEntry extends VialKeycodeDef {
  readonly group: KeycodeGroup;
  readonly value: number;
}

export interface CustomKeycode {
  readonly name?: string;
  readonly title?: string;
  readonly shortName?: string;
}

export interface CatalogOptions {
  readonly layers: number;
  readonly macroCount: number;
  readonly tapDanceCount: number;
  readonly customKeycodes?: readonly CustomKeycode[];
  readonly midi?: 'basic' | 'advanced';
}

/** Valeurs v6 complétées des formes calculées de keycodes_v6.py. */
function buildValues(): ReadonlyMap<string, number> {
  const values = new Map(Object.entries(VIAL_V6_VALUES));
  const v = (name: string): number => {
    const value = values.get(name);
    if (value === undefined) throw new Error(`Valeur Vial absente : ${name}`);
    return value;
  };
  for (let x = 0; x < 256; x++) {
    values.set(`M${String(x)}`, v('QK_MACRO') + x);
    values.set(`TD(${String(x)})`, v('QK_TAP_DANCE') + x);
  }
  const layerForms: [string, string][] = [
    ['MO', 'QK_MOMENTARY'],
    ['DF', 'QK_DEF_LAYER'],
    ['TG', 'QK_TOGGLE_LAYER'],
    ['TT', 'QK_LAYER_TAP_TOGGLE'],
    ['OSL', 'QK_ONE_SHOT_LAYER'],
    ['TO', 'QK_TO'],
    ['PDF', 'QK_PERSISTENT_DEF_LAYER'],
  ];
  for (let x = 0; x < 32; x++) {
    for (const [prefix, base] of layerForms) values.set(`${prefix}(${String(x)})`, v(base) + x);
  }
  for (let x = 0; x < 16; x++) values.set(`LT${String(x)}(kc)`, v('QK_LAYER_TAP') | ((x & 0xf) << 8));
  for (let x = 0; x < 64; x++) values.set(`USER${String(x).padStart(2, '0')}`, v('QK_KB') + x);
  return values;
}

const VALUES = buildValues();

function resolve(name: string): number {
  const value = VALUES.get(name);
  if (value === undefined) throw new Error(`Impossible de résoudre ${name}`);
  return value;
}

/** Masques (octet haut) des keycodes « à keycode interne » : LSFT(kc), LT3(kc), LCTL_T(kc)… */
const MASKED = new Set([...VALUES].filter(([name]) => name.endsWith('(kc)')).map(([, value]) => value));

const def = (id: string, label: string, tooltip?: string): VialKeycodeDef =>
  tooltip === undefined ? { id, label } : { id, label, tooltip };

export class KeycodeCatalog {
  readonly entries: readonly KeycodeEntry[];
  private readonly byValue = new Map<number, KeycodeEntry>();
  private readonly ids = new Set<string>();
  private readonly expression: KeycodeExpression;

  constructor(options: CatalogOptions) {
    const { layers } = options;
    const layerDefs: VialKeycodeDef[] = [
      { id: 'QK_LAYER_LOCK', label: 'Layer\nLock', aliases: ['QK_LLCK'], feature: 'layer_lock' },
    ];
    if (layers >= 4) layerDefs.push(def('FN_MO13', 'Fn1\n(Fn3)'), def('FN_MO23', 'Fn2\n(Fn3)'));
    for (const prefix of ['MO', 'DF', 'PDF', 'TG', 'TT', 'OSL', 'TO']) {
      for (let n = 0; n < layers; n++) {
        const id = `${prefix}(${String(n)})`;
        layerDefs.push(def(id, id));
      }
    }
    for (let n = 0; n < Math.min(layers, 16); n++) {
      layerDefs.push({ id: `LT${String(n)}(kc)`, label: `LT ${String(n)}\n(kc)`, masked: true });
    }

    const tapDance = Array.from({ length: options.tapDanceCount }, (_, n) =>
      def(`TD(${String(n)})`, `TD(${String(n)})`, 'Tap dance keycode'),
    );
    const macros = [
      ...Array.from({ length: options.macroCount }, (_, n) => def(`M${String(n)}`, `M${String(n)}`)),
      ...VIAL_GROUPS.macroBase,
    ];
    const custom = options.customKeycodes ?? [];
    const user: VialKeycodeDef[] = custom.length
      ? custom.map((c, n) => {
          const id = `USER${String(n).padStart(2, '0')}`;
          return { id, label: c.shortName ?? id, tooltip: c.title ?? id, aliases: [c.name ?? id] };
        })
      : Array.from({ length: 16 }, (_, n) =>
          def(`USER${String(n).padStart(2, '0')}`, `User ${String(n)}`, `User keycode ${String(n)}`),
        );
    const hidden = Array.from({ length: 256 }, (_, n) => def(`TD(${String(n)})`, `TD(${String(n)})`));
    const midi =
      options.midi === 'advanced'
        ? [...VIAL_GROUPS.midiBasic, ...VIAL_GROUPS.midiAdvanced]
        : options.midi === 'basic'
          ? VIAL_GROUPS.midiBasic
          : [];

    const ordered: [KeycodeGroup, readonly VialKeycodeDef[]][] = [
      ['special', VIAL_GROUPS.special],
      ['basic', VIAL_GROUPS.basic],
      ['shifted', VIAL_GROUPS.shifted],
      ['iso', VIAL_GROUPS.iso],
      ['layers', layerDefs],
      ['boot', VIAL_GROUPS.boot],
      ['modifiers', VIAL_GROUPS.modifiers],
      ['quantum', VIAL_GROUPS.quantum],
      ['backlight', VIAL_GROUPS.backlight],
      ['media', VIAL_GROUPS.media],
      ['tapDance', tapDance],
      ['macro', macros],
      ['user', user],
      ['hidden', hidden],
      ['midi', midi],
    ];

    const entries: KeycodeEntry[] = [];
    for (const [group, defs] of ordered) {
      for (const d of defs) {
        const entry: KeycodeEntry = { ...d, group, value: resolve(d.id) };
        entries.push(entry);
        this.ids.add(d.id);
        // Comme RAWCODES_MAP de Vial : en cas de doublon de valeur, la dernière entrée l'emporte.
        this.byValue.set(entry.value, entry);
      }
    }
    this.entries = entries;

    // Noms utilisables dans une expression : alias des groupes « simples » + constantes MOD_*.
    const names = new Map<string, number>();
    for (const group of ['special', 'basic', 'shifted', 'iso', 'backlight', 'media', 'user'] as const) {
      for (const entry of entries.filter((e) => e.group === group)) {
        for (const alias of [entry.id, ...(entry.aliases ?? [])]) names.set(alias, entry.value);
      }
    }
    for (const mod of ['LCTL', 'LSFT', 'LALT', 'LGUI', 'RCTL', 'RSFT', 'RALT', 'RGUI', 'MEH', 'HYPR']) {
      names.set(`MOD_${mod}`, resolve(`MOD_${mod}`));
    }
    this.expression = new KeycodeExpression(names, resolve);
  }

  /** Valeur -> nom Vial (Keycode.serialize). */
  serialize(code: number): string {
    if (!MASKED.has(code & 0xff00)) {
      const entry = this.byValue.get(code);
      if (entry) return entry.id;
    } else {
      const outer = this.byValue.get(code & 0xff00);
      const inner = this.byValue.get(code & 0x00ff);
      if (outer && inner) return outer.id.replaceAll('kc', inner.id);
    }
    return `0x${code.toString(16)}`;
  }

  /** Nom Vial ou expression -> valeur (Keycode.deserialize) ; lève une erreur si illisible. */
  deserialize(value: string | number): number {
    if (typeof value === 'number') return value;
    if (this.ids.has(value) || VALUES.has(value)) return resolve(value);
    return this.expression.evaluate(value);
  }

  entry(code: number): KeycodeEntry | undefined {
    return this.byValue.get(code);
  }
}
