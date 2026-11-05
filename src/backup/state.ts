// État complet d'un clavier (ce que contient un .vil), lecture, différences et application.
import { normalizeMacroBuffer } from '../protocol/macro';
import type { KeyboardClient } from '../protocol/client';
import { readSettings, setSetting } from '../protocol/qmk-settings';
import * as via from '../protocol/via';
import * as vial from '../protocol/vial';

export interface KeyboardState {
  readonly keymap: Uint16Array;
  /** Tampon de macros normalisé (macroCount macros terminées par 0x00). */
  readonly macroBuffer: Uint8Array;
  readonly tapDance: readonly vial.TapDance[];
  readonly combos: readonly vial.Combo[];
  readonly keyOverrides: readonly vial.KeyOverride[];
  readonly altRepeatKeys: readonly vial.AltRepeatKey[];
  readonly settings: ReadonlyMap<number, number>;
}

async function readEntries<T>(count: number, read: (index: number) => Promise<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(await read(i));
  return out;
}

/** Lit tout depuis le clavier (keymap relue pour partir de l'état réel). */
export async function readKeyboardState(client: KeyboardClient): Promise<KeyboardState> {
  const t = client.transport;
  const { dynamic, macroCount, macroBufferSize } = client.info;
  await client.reloadKeymap();
  const rawMacros = macroBufferSize ? await via.readMacroBuffer(t, macroBufferSize) : new Uint8Array(0);
  return {
    keymap: client.snapshot(),
    macroBuffer: normalizeMacroBuffer(rawMacros, macroCount),
    tapDance: await readEntries(dynamic.tapDance, (i) => vial.getTapDance(t, i)),
    combos: await readEntries(dynamic.combo, (i) => vial.getCombo(t, i)),
    keyOverrides: await readEntries(dynamic.keyOverride, (i) => vial.getKeyOverride(t, i)),
    altRepeatKeys: await readEntries(dynamic.altRepeatKey, (i) => vial.getAltRepeatKey(t, i)),
    settings: await readSettings(t),
  };
}

export interface KeyDiff {
  readonly layer: number;
  readonly row: number;
  readonly col: number;
  readonly before: number;
  readonly after: number;
}

export interface StateDiff {
  readonly keys: readonly KeyDiff[];
  readonly macros: boolean;
  readonly tapDance: readonly number[];
  readonly combos: readonly number[];
  readonly keyOverrides: readonly number[];
  readonly altRepeatKeys: readonly number[];
  readonly settings: readonly number[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const changedIndexes = <T>(before: readonly T[], after: readonly T[]): number[] =>
  after.flatMap((entry, i) => (same(entry, before[i]) ? [] : [i]));

export function diffStates(
  current: KeyboardState,
  target: KeyboardState,
  shape: { readonly rows: number; readonly cols: number },
): StateDiff {
  const keys: KeyDiff[] = [];
  const perLayer = shape.rows * shape.cols;
  target.keymap.forEach((after, i) => {
    const before = current.keymap[i] ?? 0;
    if (after !== before) {
      const layer = Math.floor(i / perLayer);
      const rest = i % perLayer;
      keys.push({ layer, row: Math.floor(rest / shape.cols), col: rest % shape.cols, before, after });
    }
  });
  return {
    keys,
    macros: !same([...current.macroBuffer], [...target.macroBuffer]),
    tapDance: changedIndexes(current.tapDance, target.tapDance),
    combos: changedIndexes(current.combos, target.combos),
    keyOverrides: changedIndexes(current.keyOverrides, target.keyOverrides),
    altRepeatKeys: changedIndexes(current.altRepeatKeys, target.altRepeatKeys),
    settings: [...target.settings].flatMap(([qsid, value]) =>
      current.settings.get(qsid) === value ? [] : [qsid],
    ),
  };
}

export function diffSize(diff: StateDiff): number {
  return (
    diff.keys.length +
    (diff.macros ? 1 : 0) +
    diff.tapDance.length +
    diff.combos.length +
    diff.keyOverrides.length +
    diff.altRepeatKeys.length +
    diff.settings.length
  );
}

export interface ApplyHooks {
  /** Déverrouillage Vial (macros, QK_BOOT) ; renvoie false si l'utilisateur abandonne. */
  readonly ensureUnlocked: () => Promise<boolean>;
  readonly onProgress?: (done: number, total: number) => void;
}

export interface ApplyReport {
  readonly done: number;
  readonly total: number;
  /** Étapes non appliquées faute de déverrouillage. */
  readonly skipped: readonly string[];
}

export class ApplyError extends Error {
  override readonly name = 'ApplyError';
  constructor(
    message: string,
    readonly done: number,
    readonly total: number,
  ) {
    super(message);
  }
}

const QK_BOOT = 0x7c00;

/** Applique les différences dans l'ordre de Vial (touches, macros, entrées dynamiques, réglages). */
export async function applyDiff(
  client: KeyboardClient,
  diff: StateDiff,
  target: KeyboardState,
  hooks: ApplyHooks,
): Promise<ApplyReport> {
  const t = client.transport;
  const total = diffSize(diff);
  const skipped: string[] = [];
  let done = 0;
  const step = async (label: string, action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      throw new ApplyError(
        `${label} : ${error instanceof Error ? error.message : String(error)}`,
        done,
        total,
      );
    }
    done++;
    hooks.onProgress?.(done, total);
  };

  let unlocked: boolean | undefined;
  const unlock = async (): Promise<boolean> => {
    unlocked ??= await hooks.ensureUnlocked();
    return unlocked;
  };

  if (diff.keys.some((k) => k.after === QK_BOOT)) await unlock();
  for (const k of diff.keys) {
    await step(`touche ${String(k.layer)}/${String(k.row)},${String(k.col)}`, () =>
      client.setKey(k.layer, k.row, k.col, k.after),
    );
  }
  if (diff.macros) {
    if (await unlock()) {
      await step('macros', () => via.writeMacroBuffer(t, target.macroBuffer));
    } else {
      skipped.push('macros');
    }
  }
  for (const i of diff.tapDance) {
    const entry = target.tapDance[i];
    if (entry) await step(`tap-dance ${String(i)}`, () => vial.setTapDance(t, i, entry));
  }
  for (const i of diff.combos) {
    const entry = target.combos[i];
    if (entry) await step(`combo ${String(i)}`, () => vial.setCombo(t, i, entry));
  }
  for (const i of diff.keyOverrides) {
    const entry = target.keyOverrides[i];
    if (entry) await step(`key override ${String(i)}`, () => vial.setKeyOverride(t, i, entry));
  }
  for (const i of diff.altRepeatKeys) {
    const entry = target.altRepeatKeys[i];
    if (entry) await step(`alt-repeat ${String(i)}`, () => vial.setAltRepeatKey(t, i, entry));
  }
  for (const qsid of diff.settings) {
    const value = target.settings.get(qsid);
    if (value !== undefined) await step(`réglage QMK ${String(qsid)}`, () => setSetting(t, qsid, value));
  }
  return { done, total, skipped };
}
