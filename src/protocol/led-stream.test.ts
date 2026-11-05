import { describe, expect, it } from 'vitest';
import { FakeKeyboard } from './fake-keyboard';
import {
  cie,
  displayColor,
  getLedFrame,
  getLedPositions,
  getLedStreamInfo,
  LedStreamBusy,
  LedStreamUnsupported,
} from './led-stream';
import { fakeColagan, fixtureDefinition, fixtureVil } from './test-helpers';
import { packet } from './packet';
import { ViaCommand } from './via';
import { VialCommand } from './vial';

describe('courbe CIE 1931 (table QMK quantum/led_tables.c)', () => {
  it('reproduit les valeurs de la table', () => {
    // valeurs relevées dans la table du firmware
    const table: [number, number][] = [
      [0, 0],
      [1, 1],
      [10, 2],
      [40, 6],
      [63, 12],
      [64, 12],
      [128, 48],
      [255, 255],
    ];
    for (const [v, expected] of table) expect(cie(v), `CIE(${String(v)})`).toBe(expected);
  });

  it("ramène une couleur d'effet à pleine luminosité et écrête en gardant la teinte", () => {
    expect(displayColor(12, 0, 0, 64)).toEqual([255, 0, 0]);
    expect(displayColor(6, 0, 12, 64)).toEqual([128, 0, 255]);
    // couleur de couche d'un ancien firmware (64, 25, 0) : orange conservé, pas jaune
    expect(displayColor(64, 25, 0, 64)).toEqual([255, 100, 0]);
    expect(displayColor(0, 0, 0, 64)).toEqual([0, 0, 0]);
    expect(displayColor(10, 10, 10, 0)).toEqual([0, 0, 0]);
  });
});

describe('commande LED 0xC0 sur le faux Colagan', () => {
  it('lit info et positions comme le vrai clavier', async () => {
    const kb = fakeColagan();
    const info = await getLedStreamInfo(kb);
    expect(info).toMatchObject({
      version: 2,
      layerCount: 8,
      activeLayer: 0,
      previewLayer: 0xff,
      ledCount: 58,
      colorsPerPacket: 9,
      positionsPerPacket: 13,
      leftCount: 29,
      masterIsLeft: false,
      remoteConnected: true,
      maxBrightness: 64,
    });
    const positions = await getLedPositions(kb, info);
    expect(positions).toHaveLength(58);
    expect(positions[0]).toEqual([0, 0]);
    expect(positions[28]).toEqual([4, 4]);
    expect(positions[29]).toEqual([5, 0]);
    expect(positions[57]).toEqual([9, 4]);
    // requête : marqueur 0xFF en octet 2, start en octet 3
    expect(Array.from(kb.sent.at(-1)?.subarray(0, 4) ?? [])).toEqual([0xc0, 0x01, 0xff, 52]);
  });

  it('lit une image en 7 requêtes, couleur unie à la courbe CIE', async () => {
    const kb = fakeColagan();
    kb.rgb = { effect: 2, speed: 0, hue: 0, saturation: 255, value: 64 };
    const info = await getLedStreamInfo(kb);
    const before = kb.sent.length;
    const frame = await getLedFrame(kb, info);
    expect(kb.sent.length - before).toBe(7);
    expect(frame.status).toBe(0);
    expect(frame.unknown.some(Boolean)).toBe(false);
    for (let led = 0; led < 58; led++) {
      expect(Array.from(frame.colors.subarray(led * 3, led * 3 + 3))).toEqual([12, 0, 0]);
    }
  });

  it("marque inconnues les LED de l'esclave quand le lien est coupé", async () => {
    const kb = fakeColagan();
    kb.remoteConnected = false;
    const info = await getLedStreamInfo(kb);
    expect(info.remoteConnected).toBe(false);
    const frame = await getLedFrame(kb, info);
    expect(frame.status).toBe(0x10);
    expect(frame.unknown.slice(0, 29).every(Boolean)).toBe(true);
    expect(frame.unknown.slice(29).some(Boolean)).toBe(false);
  });

  it('signale un firmware sans la commande', async () => {
    const kb = new FakeKeyboard({
      definition: fixtureDefinition,
      uid: fixtureVil.uid,
      layers: 8,
      rows: 10,
      cols: 6,
      ledStream: false,
    });
    await expect(getLedStreamInfo(kb)).rejects.toBeInstanceOf(LedStreamUnsupported);
  });

  it('signale un écho pendant le déverrouillage Vial', async () => {
    const kb = fakeColagan();
    await kb.request(packet(ViaCommand.vialPrefix, VialCommand.unlockStart));
    await expect(getLedStreamInfo(kb)).rejects.toBeInstanceOf(LedStreamBusy);
  });
});
