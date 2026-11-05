// Garde-fou : une couche « collante » (atteinte par TO / TG / DF…) doit garder au moins une touche de sortie,
// sinon le clavier reste bloqué dedans jusqu'au débranchement.

const QK_TO = 0x5200;
const QK_DEF_LAYER = 0x5240;
const QK_TOGGLE_LAYER = 0x5260;
const QK_LAYER_TAP_TOGGLE = 0x52c0;
const QK_PERSISTENT_DEF_LAYER = 0x52e0;
const KC_TRNS = 0x01;

const inRange = (code: number, base: number): boolean => code >= base && code < base + 0x20;

export interface LayerKeymap {
  readonly layers: number;
  /** Positions [ligne, colonne] présentes sur le clavier. */
  readonly positions: readonly (readonly [number, number])[];
  getKey(layer: number, row: number, col: number): number;
}

/** Couches qu'une touche fait « rester » actives : cibles de TO, TG, TT, DF, PDF (hors couche 0). */
export function stickyLayers(map: LayerKeymap): Set<number> {
  const sticky = new Set<number>();
  for (let layer = 0; layer < map.layers; layer++) {
    for (const [row, col] of map.positions) {
      const code = map.getKey(layer, row, col);
      for (const base of [
        QK_TO,
        QK_TOGGLE_LAYER,
        QK_LAYER_TAP_TOGGLE,
        QK_DEF_LAYER,
        QK_PERSISTENT_DEF_LAYER,
      ]) {
        if (inRange(code, base) && (code & 0x1f) !== 0) sticky.add(code & 0x1f);
      }
    }
  }
  return sticky;
}

/** Une touche permet-elle de quitter `layer` ? TO / DF / PDF vers une autre couche, TG / TT de la couche, keycodes du profil. */
export function isExit(code: number, layer: number, extraExits: ReadonlySet<number>): boolean {
  if (extraExits.has(code)) return true;
  if (inRange(code, QK_TO) || inRange(code, QK_DEF_LAYER) || inRange(code, QK_PERSISTENT_DEF_LAYER)) {
    return (code & 0x1f) !== layer;
  }
  if (inRange(code, QK_TOGGLE_LAYER) || inRange(code, QK_LAYER_TAP_TOGGLE)) return (code & 0x1f) === layer;
  return false;
}

/** Touches de sortie de `layer` ; une touche transparente reprend celle de la couche 0 (seule restée active). */
export function exitCount(map: LayerKeymap, layer: number, extraExits: ReadonlySet<number>): number {
  let count = 0;
  for (const [row, col] of map.positions) {
    let code = map.getKey(layer, row, col);
    if (code === KC_TRNS) code = map.getKey(0, row, col);
    if (isExit(code, layer, extraExits)) count++;
  }
  return count;
}

/** Couches collantes qui perdraient leur dernière sortie si la touche [layer, row, col] devenait `code`. */
export function trappedLayers(
  map: LayerKeymap,
  change: { readonly layer: number; readonly row: number; readonly col: number; readonly code: number },
  extraExits: ReadonlySet<number>,
): number[] {
  const after: LayerKeymap = {
    layers: map.layers,
    positions: map.positions,
    getKey: (l, r, c) =>
      l === change.layer && r === change.row && c === change.col ? change.code : map.getKey(l, r, c),
  };
  const sticky = new Set([...stickyLayers(map), ...stickyLayers(after)]);
  return [...sticky]
    .filter((layer) => layer > 0 && layer < map.layers)
    .filter((layer) => exitCount(map, layer, extraExits) > 0 && exitCount(after, layer, extraExits) === 0)
    .sort((a, b) => a - b);
}
