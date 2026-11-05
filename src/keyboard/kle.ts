// Lecture de la disposition KLE (keyboard-layout-editor) contenue dans la définition Vial.
// Sémantique de kle-serial : rx/ry fixent l'origine d'un groupe (et de la rotation), x/y sont des décalages,
// w/h ne valent que pour la touche suivante, chaque rangée repart à x = rx et descend d'une unité.

export interface KeyGeometry {
  readonly row: number;
  readonly col: number;
  /** Coin haut-gauche avant rotation, en unités de touche (1U = 19,05 mm). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Rotation en degrés (sens horaire) autour de (rx, ry). */
  readonly r: number;
  readonly rx: number;
  readonly ry: number;
}

interface KleProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  rx?: number;
  ry?: number;
}

export class KleError extends Error {
  override readonly name = 'KleError';
}

export function parseKle(rows: readonly unknown[]): KeyGeometry[] {
  const keys: KeyGeometry[] = [];
  const cur = { x: 0, y: 0, r: 0, rx: 0, ry: 0, w: 1, h: 1 };

  for (const row of rows) {
    if (!Array.isArray(row)) continue; // métadonnées éventuelles du clavier
    for (const item of row as unknown[]) {
      if (typeof item === 'string') {
        // Vial : « ligne,colonne » sur la première ligne du libellé (les suivantes servent aux options)
        const match = /^(\d+),(\d+)/.exec(item.split('\n')[0] ?? '');
        if (!match) throw new KleError(`Libellé de touche inattendu : « ${item} »`);
        keys.push({
          row: Number(match[1]),
          col: Number(match[2]),
          x: cur.x,
          y: cur.y,
          w: cur.w,
          h: cur.h,
          r: cur.r,
          rx: cur.rx,
          ry: cur.ry,
        });
        cur.x += cur.w;
        cur.w = 1;
        cur.h = 1;
      } else if (typeof item === 'object' && item !== null) {
        const p = item as KleProps;
        if (p.r !== undefined) cur.r = p.r;
        if (p.rx !== undefined) {
          cur.rx = p.rx;
          cur.x = p.rx;
        }
        if (p.ry !== undefined) {
          cur.ry = p.ry;
          cur.y = p.ry;
        }
        if (p.x !== undefined) cur.x += p.x;
        if (p.y !== undefined) cur.y += p.y;
        if (p.w !== undefined) cur.w = p.w;
        if (p.h !== undefined) cur.h = p.h;
      }
    }
    cur.y += 1;
    cur.x = cur.rx;
  }
  return keys;
}

/** Coins d'une touche après rotation (pour calculer l'encombrement du dessin). */
export function keyCorners(k: KeyGeometry): [number, number][] {
  const rad = (k.r * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [k.x, k.y],
    [k.x + k.w, k.y],
    [k.x + k.w, k.y + k.h],
    [k.x, k.y + k.h],
  ].map(([px = 0, py = 0]) => {
    const dx = px - k.rx;
    const dy = py - k.ry;
    return [k.rx + dx * cos - dy * sin, k.ry + dx * sin + dy * cos];
  });
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function layoutBounds(keys: readonly KeyGeometry[]): Bounds {
  const points = keys.flatMap(keyCorners);
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}
