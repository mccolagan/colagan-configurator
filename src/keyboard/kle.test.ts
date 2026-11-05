import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { keyCorners, layoutBounds, parseKle, KleError } from './kle';

const definition = JSON.parse(readFileSync('tests/fixtures/colagan-v2-definition.json', 'utf8')) as {
  layouts: { keymap: unknown[] };
};
const keys = parseKle(definition.layouts.keymap);
const find = (row: number, col: number) => keys.find((k) => k.row === row && k.col === col);

describe('parseKle sur le Colagan V2', () => {
  it('trouve les 58 touches, chaque position une seule fois', () => {
    expect(keys).toHaveLength(58);
    expect(new Set(keys.map((k) => `${String(k.row)},${String(k.col)}`)).size).toBe(58);
  });

  it('place la colonne extérieure en 1,5U aux deux bords', () => {
    expect(find(0, 5)).toMatchObject({ x: 0, y: 0, w: 1.5 });
    expect(find(5, 5)?.w).toBe(1.5);
    expect(find(0, 4)).toMatchObject({ x: 1.5, w: 1 });
  });

  it('garde des rangées alignées au pas de 1U', () => {
    expect(find(3, 0)?.y).toBe(3);
    expect(find(8, 5)?.y).toBe(3);
  });

  it('fait tourner les pouces autour de leur centre (arc ±45° / ±22,5°)', () => {
    expect(find(4, 4)).toMatchObject({ r: -45, rx: 3.8682, ry: 5.3847, w: 1 });
    expect(find(4, 4)?.x).toBeCloseTo(3.3682);
    expect(find(9, 4)?.r).toBe(45);
    expect(find(9, 2)?.r).toBe(0);
    const thumb = find(9, 0);
    if (!thumb) throw new Error('pouce [9,0] absent');
    const [cx, cy] = keyCorners(thumb).reduce(([sx, sy], [x, y]) => [sx + x / 4, sy + y / 4], [0, 0]);
    expect(cx).toBeCloseTo(10.13);
    expect(cy).toBeCloseTo(5.3847);
  });

  it('calcule l’encombrement en tenant compte des rotations', () => {
    const b = layoutBounds(keys);
    expect(b.minX).toBeCloseTo(0);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxX).toBeGreaterThan(18);
    expect(b.maxY).toBeGreaterThan(5.9);
  });

  it('refuse un libellé sans position', () => {
    expect(() => parseKle([['abc']])).toThrow(KleError);
  });
});
