// Géométrie pure de la vue 3D : placement des touches et contours de la coque, en unités de touche
// (repère KLE : x vers la droite, y vers le bas, rotations en degrés dans le sens horaire).
import { keyCorners, layoutBounds, type KeyGeometry } from '../../keyboard/kle';

export type Point = readonly [number, number];

export interface KeyPlacement {
  readonly row: number;
  readonly col: number;
  /** Centre de la touche après rotation. */
  readonly cx: number;
  readonly cy: number;
  /** Rotation en degrés, sens horaire (comme KLE). */
  readonly angle: number;
  readonly w: number;
  readonly h: number;
}

export function placeKey(k: KeyGeometry): KeyPlacement {
  const rad = (k.r * Math.PI) / 180;
  const dx = k.x + k.w / 2 - k.rx;
  const dy = k.y + k.h / 2 - k.ry;
  return {
    row: k.row,
    col: k.col,
    cx: k.rx + dx * Math.cos(rad) - dy * Math.sin(rad),
    cy: k.ry + dx * Math.sin(rad) + dy * Math.cos(rad),
    angle: k.r,
    w: k.w,
    h: k.h,
  };
}

/** Carré centré sur la touche, tourné comme elle (découpe du switch dans le dessus de la coque). */
export function rotatedSquare(p: KeyPlacement, half: number): Point[] {
  const rad = (p.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return (
    [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ] as const
  ).map(([x, y]): Point => [p.cx + x * cos - y * sin, p.cy + x * sin + y * cos]);
}

/** Coque par défaut d'un clavier sans modèle : rectangle autour des touches, avec une marge. */
export function fallbackOutline(keys: readonly KeyGeometry[], margin = 0.25): Point[] {
  const b = layoutBounds(keys);
  return [
    [b.minX - margin, b.minY - margin],
    [b.maxX + margin, b.minY - margin],
    [b.maxX + margin, b.maxY + margin],
    [b.minX - margin, b.maxY + margin],
  ];
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function polygonBounds(points: readonly Point[]): Bounds {
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

/** Encombrement des contours et des touches réunis. */
export function sceneBounds(keys: readonly KeyGeometry[], outlines: readonly (readonly Point[])[]): Bounds {
  return polygonBounds([...keys.flatMap(keyCorners), ...outlines.flat()]);
}

/** Point dans un polygone simple (règle pair-impair). */
export function pointInPolygon(points: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  points.forEach(([xi, yi], i) => {
    const [xj, yj] = points[(i + points.length - 1) % points.length] ?? [xi, yi];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  });
  return inside;
}

/** Contour (moitié) d'un point : celui qui le contient, sinon celui dont le centre est le plus proche. */
export function outlineIndex(outlines: readonly (readonly Point[])[], x: number, y: number): number {
  const inside = outlines.findIndex((outline) => pointInPolygon(outline, x, y));
  if (inside >= 0) return inside;
  let best = 0;
  let bestDistance = Infinity;
  outlines.forEach((outline, i) => {
    const b = polygonBounds(outline);
    const distance = Math.hypot((b.minX + b.maxX) / 2 - x, (b.minY + b.maxY) / 2 - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

/** Ordre de la chaîne LED d'une moitié : ligne par ligne de la matrice, colonne par colonne (LED n = CH(n+1)). */
export function chainOrder<T extends { readonly row: number; readonly col: number }>(
  keys: readonly T[],
): T[] {
  return [...keys].sort((a, b) => a.row - b.row || a.col - b.col);
}

const distinct = (values: readonly number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

/**
 * Fils de la matrice d'une moitié (sérigraphie et rayons X) : un fil sous chaque rangée, un fil à côté de chaque
 * colonne, du côté `side` (+1 à droite de la touche, -1 à gauche pour la moitié miroir).
 */
export function matrixWires(
  placements: readonly KeyPlacement[],
  side: number,
): {
  rows: { row: number; points: Point[] }[];
  cols: { col: number; points: Point[] }[];
} {
  return {
    rows: distinct(placements.map((p) => p.row)).map((row) => ({
      row,
      points: placements
        .filter((p) => p.row === row)
        .sort((a, b) => a.cx - b.cx)
        .map((p): Point => [p.cx, p.cy + 0.36]),
    })),
    cols: distinct(placements.map((p) => p.col)).map((col) => ({
      col,
      points: placements
        .filter((p) => p.col === col)
        .sort((a, b) => a.cy - b.cy)
        .map((p): Point => [p.cx + side * 0.34, p.cy]),
    })),
  };
}

/**
 * Touches qui portent les étiquettes de la vue éclatée : keycap (2e rangée, bord extérieur), switch (4e rangée,
 * bord extérieur), LED (3e rangée, 4e touche) et socket (4e rangée, 3e touche), en partant de l'intérieur.
 */
export function partKeys(
  placements: readonly KeyPlacement[],
): { caps: KeyPlacement; switches: KeyPlacement; leds: KeyPlacement; sockets: KeyPlacement } | undefined {
  const rows = distinct(placements.map((p) => p.row));
  const row = (i: number): KeyPlacement[] => {
    const wanted = rows[Math.min(i, rows.length - 1)];
    return placements.filter((p) => p.row === wanted).sort((a, b) => a.cx - b.cx);
  };
  const at = (list: readonly KeyPlacement[], i: number): KeyPlacement | undefined =>
    list[Math.max(0, Math.min(i, list.length - 1))];
  const r1 = row(1);
  const r2 = row(2);
  const r3 = row(3);
  const caps = at(r1, r1.length - 1);
  const switches = at(r3, r3.length - 1);
  const leds = at(r2, 3);
  const sockets = at(r3, 2);
  return caps && switches && leds && sockets ? { caps, switches, leds, sockets } : undefined;
}

/** Bord droit d'un contour : abscisse et étendue verticale des sommets qui le forment. */
export function rightEdge(points: readonly Point[]): { x: number; top: number; bottom: number } {
  const x = Math.max(...points.map(([px]) => px));
  const ys = points.filter(([px]) => px >= x - 0.05).map(([, py]) => py);
  return { x, top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** Aire signée (positive si les points tournent dans le sens trigonométrique du repère x/y). */
export function signedArea(points: readonly Point[]): number {
  let area = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length] ?? [x1, y1];
    area += x1 * y2 - x2 * y1;
  });
  return area / 2;
}

const unit = (x: number, y: number): Point => {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
};

/** Décale un polygone simple vers l'extérieur (d > 0) ou l'intérieur (d < 0), sommets en onglet bornés. */
export function offsetPolygon(points: readonly Point[], d: number): Point[] {
  const sign = signedArea(points) > 0 ? 1 : -1;
  const n = points.length;
  return points.map((c, i) => {
    const a = points[(i - 1 + n) % n] ?? c;
    const b = points[(i + 1) % n] ?? c;
    const e1 = unit(c[0] - a[0], c[1] - a[1]);
    const e2 = unit(b[0] - c[0], b[1] - c[1]);
    const n1: Point = [sign * e1[1], -sign * e1[0]];
    const n2: Point = [sign * e2[1], -sign * e2[0]];
    const m = unit(n1[0] + n2[0], n1[1] + n2[1]);
    const k = Math.min(3, 1 / Math.max(0.2, m[0] * n1[0] + m[1] * n1[1]));
    return [c[0] + m[0] * d * k, c[1] + m[1] * d * k];
  });
}

/**
 * Positions verticales triées, écartées pour respecter un pas minimal (hauteur de chaque élément), en gardant
 * l'ordre et le centre du groupe.
 */
export function spreadApart(ys: readonly number[], steps: readonly number[]): number[] {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1] ?? 0;
    const gap = ((steps[i - 1] ?? 0) + (steps[i] ?? 0)) / 2;
    out[i] = Math.max(out[i] ?? 0, prev + gap);
  }
  const shift = (ys.reduce((a, b) => a + b, 0) - out.reduce((a, b) => a + b, 0)) / Math.max(1, ys.length);
  return out.map((y) => y + shift);
}
