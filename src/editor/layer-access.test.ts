import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVil } from '../io/vil';
import { KeycodeCatalog } from '../keycodes/catalog';
import { FirmwareSim } from './firmware-sim';
import { parseKle } from '../keyboard/kle';
import { findTypedKey, hidUsages, sendsUsage } from './hid-usage';
import { layerAccesses, layerTarget, parentLayer, resolveKey, type KeymapView } from './layer-access';

// keymap réelle du Colagan V2 (8 couches, matrice 10 × 6)
const vil = parseVil(readFileSync('tests/fixtures/colagan-v2-default.vil', 'utf8'));
const catalog = new KeycodeCatalog({
  layers: vil.layout.length,
  macroCount: vil.macro.length,
  tapDanceCount: vil.tap_dance.length,
  customKeycodes: [],
});
const codes = vil.layout.map((layer) =>
  layer.map((row) => row.map((name) => (name === -1 ? 0 : catalog.deserialize(name)))),
);
const positions: [number, number][] = [];
codes[0]?.forEach((row, r) => {
  row.forEach((_, c) => positions.push([r, c]));
});
const view: KeymapView = {
  layers: codes.length,
  positions,
  getKey: (l, r, c) => codes[l]?.[r]?.[c] ?? 0,
  serialize: (code) => catalog.serialize(code),
};
const USER00 = 0x7e00;

describe('accès aux couches', () => {
  it('reconnaît les keycodes de couche par leur nom Vial', () => {
    expect(layerTarget('MO(1)')).toEqual({ kind: 'MO', layer: 1 });
    expect(layerTarget('TO(3)')).toEqual({ kind: 'TO', layer: 3 });
    expect(layerTarget('LT2(KC_SPACE)')).toEqual({ kind: 'LT', layer: 2 });
    expect(layerTarget('KC_A')).toBeUndefined();
  });

  it('lit dans la keymap comment on atteint chaque couche', () => {
    expect(layerAccesses(view, 1)).toEqual([{ kind: 'MO', from: 0, row: 4, col: 0 }]);
    expect(layerAccesses(view, 2).map((a) => `${a.kind}@${String(a.from)}`)).toEqual(['TO@5']);
    expect(layerAccesses(view, 4).map((a) => `${a.kind}@${String(a.from)}`)).toEqual(['MO@3']);
  });

  it('fait tomber les transparentes sur la couche qui tient la couche (MO), sinon sur la 0 (TO)', () => {
    expect(parentLayer(view, 4)).toBe(3);
    expect(parentLayer(view, 2)).toBe(0);
    // [0,0] de MMO UI est transparente : on lit celle de MMO, transparente aussi, puis BASE
    expect(resolveKey(view, 4, 0, 0)).toEqual({ code: view.getKey(0, 0, 0), layer: 0 });
  });
});

describe('simulation des couches (onglet Essai)', () => {
  it('MO(1) ouvre FN tant que la touche est tenue', () => {
    const sim = new FirmwareSim(view, { code: USER00, layer: 5 });
    expect(sim.press(4, 0)).toEqual({ kind: 'layer', layer: 1, via: 'MO(1)' });
    expect(sim.layer).toBe(1);
    expect(sim.activeLayers).toEqual([0, 1]);
    expect(sim.release(4, 0)).toBe(true);
    expect(sim.layer).toBe(0);
  });

  it('SEL x3 ouvre le sélecteur après trois appuis rapides, puis TO(2) bascule sur FPS', () => {
    const sim = new FirmwareSim(view, { code: USER00, layer: 5 });
    expect(sim.press(9, 4, 0)).toEqual({ kind: 'none' });
    expect(sim.press(9, 4, 100)).toEqual({ kind: 'none' });
    expect(sim.press(9, 4, 200)).toMatchObject({ kind: 'layer', layer: 5 });
    expect(sim.press(5, 1)).toMatchObject({ kind: 'layer', layer: 2 });
    expect(sim.activeLayers).toEqual([0, 2]);
  });

  it('trois appuis trop lents ne font rien', () => {
    const sim = new FirmwareSim(view, { code: USER00, layer: 5 });
    sim.press(9, 4, 0);
    sim.press(9, 4, 400);
    expect(sim.press(9, 4, 800)).toEqual({ kind: 'none' });
  });

  it('une touche normale renvoie son keycode, transparente comprise', () => {
    const sim = new FirmwareSim(view);
    sim.reset(1);
    expect(sim.press(0, 0)).toEqual({
      kind: 'key',
      code: view.getKey(1, 0, 0) === 1 ? view.getKey(0, 0, 0) : view.getKey(1, 0, 0),
    });
  });
});

describe('frappes du vrai clavier', () => {
  it('traduit event.code en usage HID', () => {
    expect(hidUsages('KeyA')).toEqual([0x04]);
    expect(hidUsages('Digit0')).toEqual([0x27]);
    expect(hidUsages('F12')).toEqual([0x45]);
    expect(hidUsages('Backslash')).toEqual([0x31, 0x32]);
    expect(hidUsages('Inconnu')).toEqual([]);
  });

  it('retrouve un usage derrière un mod-tap ou un LT, pas derrière MO()', () => {
    expect(sendsUsage(0x04, 0x04)).toBe(true);
    expect(sendsUsage(catalog.deserialize('LT(2, KC_SPC)'), 0x2c)).toBe(true);
    expect(sendsUsage(catalog.deserialize('MO(1)'), 0x21)).toBe(false);
  });

  it('préfère la touche posée sur la couche à une transparente qui retombe sur la couche 0', () => {
    const definition = JSON.parse(readFileSync('tests/fixtures/colagan-v2-definition.json', 'utf8')) as {
      layouts: { keymap: unknown[] };
    };
    const keys = parseKle(definition.layouts.keymap);
    const kcW = hidUsages('KeyW');
    // couche 3 : W en [6,2] (droite) ; la gauche, transparente, retombe sur le W de la couche 0 en [1,3],
    // placé avant dans l'ordre du layout
    expect(findTypedKey(view, keys, [3, 0], kcW)).toMatchObject({ row: 6, col: 2 });
    expect(findTypedKey(view, keys, [0], kcW)).toMatchObject({ row: 1, col: 3 });
    expect(findTypedKey(view, keys, [3, 0], kcW, (row) => row >= 5)).toMatchObject({ row: 1, col: 3 });
  });
});
