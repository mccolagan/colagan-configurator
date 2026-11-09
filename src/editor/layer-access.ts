// Comment on atteint chaque couche, lu dans la keymap : MO(n), TO(n), LT(n, …) posés sur d'autres couches.

export type AccessKind = 'MO' | 'TO' | 'TG' | 'TT' | 'OSL' | 'DF' | 'LT';

export interface LayerAccess {
  readonly kind: AccessKind;
  readonly from: number;
  readonly row: number;
  readonly col: number;
}

export interface KeymapView {
  readonly layers: number;
  readonly positions: readonly (readonly [number, number])[];
  readonly getKey: (layer: number, row: number, col: number) => number;
  /** Nom Vial du keycode (KeycodeCatalog.serialize). */
  readonly serialize: (code: number) => string;
}

/** Couche ciblée par un keycode de couche, d'après son nom Vial (MO(2), LT2(KC_SPACE)…). */
export function layerTarget(name: string): { kind: AccessKind; layer: number } | undefined {
  const plain = /^(MO|TO|TG|TT|OSL|DF)\((\d+)\)$/.exec(name);
  if (plain?.[1] && plain[2]) return { kind: plain[1] as AccessKind, layer: Number(plain[2]) };
  const tap = /^LT(\d+)\(/.exec(name);
  if (tap?.[1]) return { kind: 'LT', layer: Number(tap[1]) };
  return undefined;
}

export function layerAccesses(view: KeymapView, target: number): LayerAccess[] {
  const found: LayerAccess[] = [];
  for (let layer = 0; layer < view.layers; layer++) {
    if (layer === target) continue;
    for (const [row, col] of view.positions) {
      const hit = layerTarget(view.serialize(view.getKey(layer, row, col)));
      if (hit?.layer === target) found.push({ kind: hit.kind, from: layer, row, col });
    }
  }
  return found;
}

/**
 * Couche sous-jacente d'une couche (là où tombent ses touches transparentes) : celle d'où on la tient
 * (MO, LT, OSL, TT, TG la laissent active) ; TO et DF ne gardent que la couche 0.
 */
export function parentLayer(view: KeymapView, layer: number): number | undefined {
  if (layer === 0) return undefined;
  const held = layerAccesses(view, layer).find((a) => a.kind !== 'TO' && a.kind !== 'DF' && a.from < layer);
  return held ? held.from : 0;
}

/** Keycode réellement envoyé par une position : on descend les couches tant que la touche est transparente. */
export function resolveKey(
  view: KeymapView,
  layer: number,
  row: number,
  col: number,
): { code: number; layer: number } {
  let current: number | undefined = layer;
  const seen = new Set<number>();
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const code = view.getKey(current, row, col);
    if (code !== 1) return { code, layer: current };
    current = parentLayer(view, current);
  }
  return { code: 1, layer };
}
