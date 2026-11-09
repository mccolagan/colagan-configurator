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

/** Encombrement des contours et des touches réunis. */
export function sceneBounds(
  keys: readonly KeyGeometry[],
  outlines: readonly (readonly Point[])[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  const points = [...keys.flatMap(keyCorners), ...outlines.flat()];
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
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
