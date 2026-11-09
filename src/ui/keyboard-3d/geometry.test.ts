import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKle } from '../../keyboard/kle';
import { COLAGAN_V2_MODEL } from '../../profiles/colagan-v2-model';
import { fallbackOutline, offsetPolygon, placeKey, rotatedSquare, sceneBounds, signedArea } from './geometry';
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
