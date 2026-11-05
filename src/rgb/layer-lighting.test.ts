import { describe, expect, it } from 'vitest';
import { KeyEditor } from '../editor/key-editor';
import { FakeKeyboard } from '../protocol/fake-keyboard';
import { getLedFrame, getLedStreamInfo, getLayerColors, setPreviewLayer } from '../protocol/led-stream';
import { fakeColagan, fixtureDefinition, fixtureVil } from '../protocol/test-helpers';
import { LayerLighting } from './layer-lighting';

describe('couleurs par couche (firmware v2)', () => {
  it('lit les couleurs par défaut et les retrouve par position de touche', async () => {
    const lighting = await LayerLighting.load(fakeColagan());
    expect(lighting?.layerCount).toBe(8);
    // couche FPS : 1-5 bleus, Tab jaune ; BASE : tout transparent
    expect(lighting?.color(2, 5, 0)).toEqual([0, 0, 255]);
    expect(lighting?.color(2, 5, 5)).toEqual([255, 255, 0]);
    expect(lighting?.color(2, 0, 0)).toEqual([0, 0, 0]);
    expect(lighting?.color(0, 5, 0)).toBeNull();
    expect(lighting?.color(0, 4, 5)).toBeUndefined();
  });

  it('écrit des plages de 8 LED max et garde la transparence', async () => {
    const kb = fakeColagan();
    const lighting = await LayerLighting.load(kb);
    const colors = new Map<number, readonly [number, number, number] | null>();
    for (let led = 25; led < 40; led++) colors.set(led, led % 2 ? [1, 2, 3] : null);
    const before = kb.sent.length;
    await lighting?.write(6, colors);
    // 25-32 puis 33-39 : deux requêtes
    expect(kb.sent.length - before).toBe(2);
    const read = await getLayerColors(kb, 6, 58);
    expect(read[25]).toEqual([1, 2, 3]);
    expect(read[26]).toBeNull();
    expect(read[39]).toEqual([1, 2, 3]);
    expect(read[24]).toBeNull();
  });

  it("l'aperçu d'une couche change l'image du clavier puis expire", async () => {
    let now = 0;
    const kb = new FakeKeyboard({
      definition: fixtureDefinition,
      uid: fixtureVil.uid,
      layers: 8,
      rows: 10,
      cols: 6,
      clock: () => now,
      layerColors: { 2: Array.from({ length: 58 }, () => [255, 0, 0] as const) },
    });
    kb.rgb = { effect: 2, speed: 0, hue: 85, saturation: 255, value: 64 };
    const info = await getLedStreamInfo(kb);
    expect(Array.from((await getLedFrame(kb, info)).colors.subarray(0, 3))).toEqual([0, 12, 0]);
    await setPreviewLayer(kb, 2);
    expect((await getLedStreamInfo(kb)).previewLayer).toBe(2);
    expect(Array.from((await getLedFrame(kb, info)).colors.subarray(0, 3))).toEqual([12, 0, 0]);
    now += 3500;
    expect((await getLedStreamInfo(kb)).previewLayer).toBe(0xff);
    expect(Array.from((await getLedFrame(kb, info)).colors.subarray(0, 3))).toEqual([0, 12, 0]);
  });

  it("un effet propre à la couche remplace l'effet global, et se remet à zéro", async () => {
    const kb = fakeColagan();
    const lighting = await LayerLighting.load(kb);
    await lighting?.setEffect(3, { override: true, effect: 0, speed: 0, hue: 0, saturation: 0, value: 0 });
    expect(kb.layerEffects[3]?.override).toBe(true);
    await setPreviewLayer(kb, 3);
    const info = await getLedStreamInfo(kb);
    expect((await getLedFrame(kb, info)).colors.every((c) => c === 0)).toBe(true);
    await lighting?.reset(3);
    expect(lighting?.effect(3)?.override).toBe(false);
    expect(lighting?.color(3, 5, 0)).toEqual([0, 0, 255]);
  });

  it('une peinture se défait et se refait par l’historique', async () => {
    const kb = fakeColagan();
    const lighting = await LayerLighting.load(kb);
    if (!lighting) throw new Error('couches non lues');
    const editor = new KeyEditor({ getKey: () => 0, setKey: () => Promise.resolve(0) }, undefined, {
      setLedColors: (layer, colors) => lighting.write(layer, colors),
    });
    const after = new Map([[29, [255, 255, 255] as const]]);
    const before = lighting.stage(2, after);
    await editor.change({ kind: 'leds', layer: 2, before, after });
    expect(kb.layerColors[2]?.[29]).toEqual([255, 255, 255]);
    await editor.undo();
    expect(kb.layerColors[2]?.[29]).toEqual([0, 0, 255]);
    expect(lighting.colorOfLed(2, 29)).toEqual([0, 0, 255]);
    await editor.redo();
    expect(kb.layerColors[2]?.[29]).toEqual([255, 255, 255]);
  });
});
