import { describe, expect, it } from 'vitest';
import { parseKle } from '../keyboard/kle';
import { KeyboardClient } from '../protocol/client';
import { fakeColagan } from '../protocol/test-helpers';
import { exitCount, stickyLayers, trappedLayers, type LayerKeymap } from './layer-guard';

const SEL_X3 = 0x7e00;
const exits = new Set([SEL_X3]);

async function colagan(): Promise<LayerKeymap> {
  const client = await KeyboardClient.connect(fakeColagan());
  return {
    layers: client.info.layers,
    positions: parseKle(client.info.definition.layouts.keymap).map((k) => [k.row, k.col] as const),
    getKey: (l, r, c) => client.getKey(l, r, c),
  };
}

describe('garde-fou des couches de jeu', () => {
  it('repère les couches atteintes par TO() depuis le sélecteur', async () => {
    const map = await colagan();
    expect([...stickyLayers(map)].sort()).toEqual([2, 3]);
    expect(exitCount(map, 2, exits)).toBeGreaterThan(0);
  });

  it('avertit si la dernière sortie de la couche FPS disparaît', async () => {
    const map = await colagan();
    expect(map.getKey(2, 9, 4)).toBe(SEL_X3);
    expect(trappedLayers(map, { layer: 2, row: 9, col: 4, code: 0x04 }, exits)).toEqual([2]);
    // remplacer par une autre sortie (TO(0)) : pas d'alerte
    expect(trappedLayers(map, { layer: 2, row: 9, col: 4, code: 0x5200 }, exits)).toEqual([]);
  });

  it('tient compte des touches transparentes qui reprennent la couche 0', () => {
    // 3 couches, 2 touches : [0,0] = SELx3 sur la base, [0,1] = TO(2) sur la couche 1, couche 2 transparente
    const keys = new Map([
      ['0,0,0', SEL_X3],
      ['1,0,1', 0x5202],
      ['2,0,0', 0x01],
      ['2,0,1', 0x01],
    ]);
    const map: LayerKeymap = {
      layers: 3,
      positions: [
        [0, 0],
        [0, 1],
      ],
      getKey: (l, r, c) => keys.get(`${String(l)},${String(r)},${String(c)}`) ?? 0,
    };
    expect(exitCount(map, 2, exits)).toBe(1);
    expect(trappedLayers(map, { layer: 0, row: 0, col: 0, code: 0x04 }, exits)).toEqual([2]);
  });

  it('ignore les touches sans rapport', async () => {
    const map = await colagan();
    expect(trappedLayers(map, { layer: 2, row: 1, col: 1, code: 0x04 }, exits)).toEqual([]);
  });
});
