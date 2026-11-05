// Conversion état du clavier <-> fichier .vil, identique à save_layout / restore_layout de vial-gui.
import type { VilFile, VilKeycode } from '../io/vil';
import type { KeycodeCatalog } from '../keycodes/catalog';
import type { KeyboardInfo } from '../protocol/client';
import { deserializeMacros, serializeMacros, type Macro } from '../protocol/macro';
import { QSID_WIDTHS } from '../protocol/qmk-settings';
import type { KeyboardState } from './state';

/** Positions « r,c » présentes dans le dessin : les autres valent -1 dans le .vil. */
export type Positions = ReadonlySet<string>;

const pos = (row: number, col: number): string => `${String(row)},${String(col)}`;

export function stateToVil(
  info: KeyboardInfo,
  state: KeyboardState,
  catalog: KeycodeCatalog,
  positions: Positions,
): VilFile {
  const { layers, rows, cols } = info;
  const s = (code: number): string => catalog.serialize(code);
  const layout: VilKeycode[][][] = Array.from({ length: layers }, (_, l) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c): VilKeycode => {
        if (!positions.has(pos(r, c))) return -1;
        return s(state.keymap[(l * rows + r) * cols + c] ?? 0);
      }),
    ),
  );
  // l'ordre des clés est celui de save_layout() : le fichier reste identique octet pour octet
  return {
    version: 1,
    uid: info.uid,
    layout,
    encoder_layout: Array.from({ length: layers }, () => []),
    layout_options: -1,
    macro: deserializeMacros(state.macroBuffer, info.macroCount, catalog).map((m) => m.map((a) => [...a])),
    vial_protocol: info.vialProtocol,
    via_protocol: info.viaProtocol,
    tap_dance: state.tapDance.map((td) => [
      s(td.onTap),
      s(td.onHold),
      s(td.onDoubleTap),
      s(td.onTapHold),
      td.tappingTerm,
    ]),
    combo: state.combos.map((c) => [s(c.keys[0]), s(c.keys[1]), s(c.keys[2]), s(c.keys[3]), s(c.output)]),
    key_override: state.keyOverrides.map((ko) => ({
      trigger: s(ko.trigger),
      replacement: s(ko.replacement),
      layers: ko.layers,
      trigger_mods: ko.triggerMods,
      negative_mod_mask: ko.negativeModMask,
      suppressed_mods: ko.suppressedMods,
      options: ko.options,
    })),
    alt_repeat_key: state.altRepeatKeys.map((ar) => ({
      keycode: s(ar.keycode),
      alt_keycode: s(ar.altKeycode),
      allowed_mods: ar.allowedMods,
      options: ar.options,
    })),
    settings: Object.fromEntries(
      [...state.settings].sort(([a], [b]) => a - b).map(([q, v]) => [String(q), v]),
    ),
  };
}

export class VilImportError extends Error {
  override readonly name = 'VilImportError';
}

export interface ImportCheck {
  /** Avertissements non bloquants (autre clavier, protocole différent…). */
  readonly warnings: readonly string[];
}

/** Vérifie qu'un .vil peut s'appliquer à ce clavier ; lève VilImportError si la forme est incompatible. */
export function checkVil(vil: VilFile, info: KeyboardInfo): ImportCheck {
  const warnings: string[] = [];
  if (!Array.isArray(vil.layout) || vil.layout.length === 0)
    throw new VilImportError('layout absent ou vide');
  if (vil.layout.length > info.layers) {
    throw new VilImportError(
      `le fichier a ${String(vil.layout.length)} couches, le clavier ${String(info.layers)}`,
    );
  }
  for (const layer of vil.layout) {
    if (
      !Array.isArray(layer) ||
      layer.length !== info.rows ||
      layer.some((row) => row.length !== info.cols)
    ) {
      throw new VilImportError(`matrice différente (attendu ${String(info.rows)}×${String(info.cols)})`);
    }
  }
  if (vil.uid !== info.uid) warnings.push('uid');
  if (vil.layout.length < info.layers) warnings.push('layers');
  return { warnings };
}

/**
 * État cible après import : comme restore_layout, seules les positions du dessin, les entrées présentes dans
 * le fichier et les réglages gérés par le firmware sont remplacés ; le reste garde sa valeur actuelle.
 */
export function vilToState(
  vil: VilFile,
  info: KeyboardInfo,
  current: KeyboardState,
  catalog: KeycodeCatalog,
  positions: Positions,
): KeyboardState {
  const { rows, cols } = info;
  // sections facultatives : un .vil ancien ou partiel peut ne pas les avoir (restore_layout utilise data.get)
  const file = vil as Partial<
    Pick<VilFile, 'macro' | 'tap_dance' | 'combo' | 'key_override' | 'alt_repeat_key' | 'settings'>
  >;
  const d = (value: unknown): number => {
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new VilImportError(`keycode invalide : ${String(value)}`);
    try {
      return catalog.deserialize(value);
    } catch {
      throw new VilImportError(`keycode illisible : ${String(value)}`);
    }
  };

  const keymap = current.keymap.slice();
  vil.layout.forEach((layer, l) => {
    layer.forEach((row, r) => {
      row.forEach((code, c) => {
        if (positions.has(pos(r, c))) keymap[(l * rows + r) * cols + c] = d(code);
      });
    });
  });

  let macroBuffer = current.macroBuffer;
  if (Array.isArray(file.macro)) {
    const serialized = serializeMacros(file.macro as unknown as Macro[], info.macroCount, catalog);
    if (serialized.length > info.macroBufferSize) {
      throw new VilImportError(
        `macros trop longues : ${String(serialized.length)} octets pour ${String(info.macroBufferSize)} disponibles`,
      );
    }
    macroBuffer = serialized;
  }

  const merge = <T, E>(
    currentList: readonly T[],
    entries: readonly E[] | undefined,
    read: (e: E) => T,
  ): T[] =>
    currentList.map((entry, i) => {
      const e = entries?.[i];
      return e === undefined ? entry : read(e);
    });

  const settings = new Map(current.settings);
  for (const [key, value] of Object.entries(file.settings ?? {})) {
    const qsid = Number(key);
    if (settings.has(qsid) && QSID_WIDTHS.has(qsid) && typeof value === 'number') settings.set(qsid, value);
  }

  return {
    keymap,
    macroBuffer,
    tapDance: merge(current.tapDance, file.tap_dance, (e) => ({
      onTap: d(e[0]),
      onHold: d(e[1]),
      onDoubleTap: d(e[2]),
      onTapHold: d(e[3]),
      tappingTerm: e[4],
    })),
    combos: merge(current.combos, file.combo, (e) => ({
      keys: [d(e[0]), d(e[1]), d(e[2]), d(e[3])] as [number, number, number, number],
      output: d(e[4]),
    })),
    keyOverrides: merge(current.keyOverrides, file.key_override, (e) => ({
      trigger: d(e.trigger),
      replacement: d(e.replacement),
      layers: e.layers,
      triggerMods: e.trigger_mods,
      negativeModMask: e.negative_mod_mask,
      suppressedMods: e.suppressed_mods,
      options: e.options,
    })),
    altRepeatKeys: merge(current.altRepeatKeys, file.alt_repeat_key, (e) => ({
      keycode: d(e.keycode),
      altKeycode: d(e.alt_keycode),
      allowedMods: e.allowed_mods,
      options: e.options,
    })),
    settings,
  };
}
