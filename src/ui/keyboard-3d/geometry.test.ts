import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKle } from '../../keyboard/kle';
import { COLAGAN_V2_MODEL } from '../../profiles/colagan-v2-model';
import {
  chainOrder,
  fallbackOutline,
  matrixWires,
  offsetPolygon,
  outlineIndex,
  partKeys,
  placeKey,
  pointInPolygon,
  rightEdge,
  rotatedSquare,
  sceneBounds,
  signedArea,
  spreadApart,
} from './geometry';
import { ledColor, legendColor, parseCssColor } from './led-color';

const definition = JSON.parse(readFileSync('tests/fixtures/colagan-v2-definition.json', 'utf8')) as {
  layouts: { keymap: unknown[] };
};
const keys = parseKle(definition.layouts.keymap);
const key = (row: number, col: number) => {
  const k = keys.find((g) => g.row === row && g.col === col);
  if (!k) throw new Error(`touche ${String(row)},${String(col)} absente`);
  return k;
};

describe('placement des touches', () => {
  it('garde le centre des pouces tournés sur leur origine de rotation', () => {
    const thumb = placeKey(key(4, 4));
    expect(thumb.cx).toBeCloseTo(3.8682, 4);
    expect(thumb.cy).toBeCloseTo(5.3847, 4);
    expect(thumb.angle).toBe(-45);
  });

  it('place une touche 1,5U droite au milieu de sa largeur', () => {
    const esc = placeKey(key(0, 5));
    expect(esc.cx).toBeCloseTo(0.75, 6);
    expect(esc.cy).toBeCloseTo(0.5, 6);
    expect(esc.w).toBe(1.5);
  });

  it('tourne la découpe du switch avec la touche', () => {
    const [a, b] = rotatedSquare(placeKey(key(4, 0)), 0.5);
    expect(a && b && Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(1, 6);
    expect(a && b && Math.atan2(b[1] - a[1], b[0] - a[0])).toBeCloseTo(Math.PI / 4, 6);
  });
});

describe('contours', () => {
  it('le contour KiCad du Colagan entoure toutes les touches de sa moitié', () => {
    const [left, right] = COLAGAN_V2_MODEL.outlines;
    expect(left && right).toBeTruthy();
    const bounds = sceneBounds(keys, COLAGAN_V2_MODEL.outlines);
    expect(bounds.minX).toBeCloseTo(0, 1);
    expect(bounds.maxX).toBeCloseTo(18.26, 1);
    expect(bounds.minY).toBeCloseTo(0, 2);
  });

  it('décale un carré vers l’extérieur puis l’intérieur, quel que soit son sens', () => {
    const square = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ] as const;
    for (const poly of [square, [...square].reverse()]) {
      expect(Math.abs(signedArea(offsetPolygon(poly, 0.5)))).toBeCloseTo(9, 6);
      expect(Math.abs(signedArea(offsetPolygon(poly, -0.5)))).toBeCloseTo(1, 6);
    }
  });

  it('entoure un clavier inconnu d’un rectangle avec marge', () => {
    const outline = fallbackOutline(keys, 0.25);
    expect(outline).toHaveLength(4);
    expect(outline[0]?.[0]).toBeLessThan(0);
  });
});

describe('moitiés et chaîne LED', () => {
  const outlines = COLAGAN_V2_MODEL.outlines;
  const placements = keys.map(placeKey);
  const halfOf = (row: number, col: number): number => {
    const p = placeKey(key(row, col));
    return outlineIndex(outlines, p.cx, p.cy);
  };

  it('range les rangées 0-4 à gauche et 5-9 à droite, pouces compris', () => {
    expect(halfOf(0, 5)).toBe(0);
    expect(halfOf(4, 4)).toBe(0);
    expect(halfOf(5, 0)).toBe(1);
    expect(halfOf(9, 4)).toBe(1);
    const halves = placements.map((p) => outlineIndex(outlines, p.cx, p.cy));
    expect([halves.filter((h) => h === 0).length, halves.filter((h) => h === 1).length]).toEqual([29, 29]);
  });

  it('suit la chaîne linéaire LED n = CH(n+1) : rangée par rangée, du milieu vers l’extérieur', () => {
    const right = chainOrder(placements.filter((p) => p.row >= 5));
    expect(right[0]).toMatchObject({ row: 5, col: 0 });
    expect(right[5]).toMatchObject({ row: 5, col: 5 });
    expect(right[24]).toMatchObject({ row: 9, col: 0 });
    expect(right[28]).toMatchObject({ row: 9, col: 4 });
  });

  it('place les microcontrôleurs, l’USB-C et les trous sur la bonne carte', () => {
    const [left, right] = outlines;
    if (!left || !right) throw new Error('contours absents');
    const [pico, picoW] = COLAGAN_V2_MODEL.boards ?? [];
    expect(pico && pointInPolygon(right, pico.x, pico.y)).toBe(true);
    expect(picoW && pointInPolygon(left, picoW.x, picoW.y)).toBe(true);
    for (const link of COLAGAN_V2_MODEL.links ?? []) {
      const inside = (o: typeof left): boolean => pointInPolygon(o, link.edge - link.out * 0.2, link.y);
      expect(inside(left) !== inside(right)).toBe(true);
      // la prise est sur le bord intérieur : le câble sort vers l'autre moitié
      expect(inside(right) ? link.out : -link.out).toBe(-1);
    }
    expect((COLAGAN_V2_MODEL.holes ?? []).every(([x, y]) => outlineIndex(outlines, x, y) >= 0)).toBe(true);
  });

  it('tire un fil par rangée sous les touches et un fil par colonne côté extérieur', () => {
    const right = placements.filter((p) => p.row >= 5);
    const wires = matrixWires(right, 1);
    expect(wires.rows.map((w) => w.row)).toEqual([5, 6, 7, 8, 9]);
    expect(wires.cols).toHaveLength(6);
    const first = wires.rows[0]?.points;
    expect(first?.[0]?.[0]).toBeLessThan(first?.[1]?.[0] ?? 0);
    expect(wires.cols[0]?.points[0]?.[0]).toBeCloseTo(placeKey(key(5, 0)).cx + 0.34, 6);
    expect(matrixWires(right, -1).cols[0]?.points[0]?.[0]).toBeCloseTo(placeKey(key(5, 0)).cx - 0.34, 6);
  });

  it('choisit les touches des étiquettes de la vue éclatée comme la maquette', () => {
    const parts = partKeys(placements.filter((p) => p.row >= 5));
    expect(parts?.caps).toMatchObject({ row: 6, col: 5 });
    expect(parts?.switches).toMatchObject({ row: 8, col: 5 });
    expect(parts?.leds).toMatchObject({ row: 7, col: 3 });
    expect(parts?.sockets).toMatchObject({ row: 8, col: 2 });
    expect(partKeys([])).toBeUndefined();
  });

  it('trouve le bord droit de la carte droite', () => {
    const edge = rightEdge(COLAGAN_V2_MODEL.outlines[1] ?? []);
    expect(edge.x).toBeCloseTo(18.26, 2);
    expect(edge.top).toBeCloseTo(0, 6);
    expect(edge.bottom).toBeCloseTo(4.008, 3);
  });
});

describe('étiquettes de la pile', () => {
  it('écarte les étiquettes trop proches en gardant leur ordre et leur centre', () => {
    const [a = 0, b = 0, c = 0] = spreadApart([100, 110, 120], [30, 30, 30]);
    expect(b - a).toBeCloseTo(30, 6);
    expect(c - b).toBeCloseTo(30, 6);
    expect((a + b + c) / 3).toBeCloseTo(110, 6);
    expect(spreadApart([0, 100], [20, 20])).toEqual([0, 100]);
  });
});

describe('couleurs', () => {
  it('lit les deux formats produits par l’aperçu et le panneau Couleurs', () => {
    expect(parseCssColor('rgb(255 0 128)')).toEqual([1, 0, 128 / 255]);
    expect(parseCssColor('rgb(10, 20, 30)')).toEqual([10 / 255, 20 / 255, 30 / 255]);
    expect(parseCssColor('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(parseCssColor('n’importe quoi')).toBeUndefined();
  });

  it('éteint la LED d’une touche sans état et garde la légende grise', () => {
    expect(ledColor(undefined)).toEqual([0, 0, 0]);
    expect(ledColor({ kind: 'off' })).toEqual([0, 0, 0]);
    const legend = legendColor([0, 0, 0]);
    expect(legend[0]).toBe(legend[2]);
  });

  it('colore la légende avec la teinte de la LED, même faiblement allumée', () => {
    const dim = legendColor([0, 0, 0.1]);
    expect(dim[2]).toBeGreaterThan(dim[0]);
    const full = legendColor([0, 0, 1]);
    expect(full[2]).toBeCloseTo(0.98, 2);
    expect(full[0]).toBeLessThan(0.5);
  });
});
