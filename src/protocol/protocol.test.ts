import { describe, expect, it } from 'vitest';
import { KeyboardClient } from './client';
import { packet, ProtocolError } from './packet';
import { colaganCatalog, fakeColagan, fixtureKeymap, fixtureVil } from './test-helpers';
import * as via from './via';
import * as vial from './vial';
import * as vialrgb from './vialrgb';

describe('encodage des rapports', () => {
  it('complète à 32 octets et refuse plus long', () => {
    expect(packet(0x04, 1, 2, 3)).toEqual(Uint8Array.from([4, 1, 2, 3, ...new Array<number>(28).fill(0)]));
    expect(() => packet(...new Array<number>(33).fill(0))).toThrow(ProtocolError);
  });

  it('écrit une touche en big-endian (VIA)', async () => {
    const kb = fakeColagan();
    await via.setKeycode(kb, 2, 7, 1, 0x5224);
    expect(Array.from(kb.sent.at(-1)?.subarray(0, 6) ?? [])).toEqual([0x05, 2, 7, 1, 0x52, 0x24]);
  });
});

describe('KeyboardClient.connect sur le faux Colagan', () => {
  it('lit identité, définition, keymap et RGB comme le vrai clavier', async () => {
    const client = await KeyboardClient.connect(fakeColagan());
    const { info } = client;
    expect(info.viaProtocol).toBe(9);
    expect(info.vialProtocol).toBe(6);
    expect(info.uid).toBe(fixtureVil.uid);
    expect(info.definition.name).toBe('Colagan V2');
    expect(info.definition.customKeycodes?.[0]?.name).toBe('SEL x3');
    expect([info.layers, info.rows, info.cols]).toEqual([8, 10, 6]);
    expect(client.snapshot()).toEqual(fixtureKeymap());
    expect(info.dynamic).toMatchObject({ tapDance: 32, combo: 32, keyOverride: 32, altRepeatKey: 32 });
    expect(info.macroCount).toBe(16);
    expect(info.macroBufferSize).toBe(1903);
    expect(info.rgb?.info.maxBrightness).toBe(64);
    expect(info.rgb?.supportedEffects).toHaveLength(23);
    expect(info.rgb?.initialMode.effect).toBe(14);
  });

  it('nomme les touches comme Vial (pouce droit = SEL x3)', async () => {
    const client = await KeyboardClient.connect(fakeColagan());
    expect(colaganCatalog.serialize(client.getKey(0, 9, 4))).toBe('USER00');
    expect(colaganCatalog.serialize(client.getKey(3, 8, 1))).toBe('MO(4)');
  });

  it('écrit puis relit une touche', async () => {
    const kb = fakeColagan();
    const client = await KeyboardClient.connect(kb);
    expect(await client.setKey(6, 5, 0, colaganCatalog.deserialize('KC_A'))).toBe(0x04);
    expect(client.getKey(6, 5, 0)).toBe(0x04);
    expect(kb.keymap[(6 * 10 + 5) * 6]).toBe(0x04);
  });

  it('QK_BOOT est remplacé par KC_NO tant que le clavier est verrouillé', async () => {
    const kb = fakeColagan();
    const client = await KeyboardClient.connect(kb);
    expect(await client.setKey(6, 5, 0, 0x7c00)).toBe(0);
    kb.unlocked = true;
    expect(await client.setKey(6, 5, 0, 0x7c00)).toBe(0x7c00);
  });

  it('refuse une position hors matrice', async () => {
    const client = await KeyboardClient.connect(fakeColagan());
    expect(() => client.getKey(8, 0, 0)).toThrow(RangeError);
  });
});

describe('Vial', () => {
  it('donne les touches de déverrouillage et déverrouille quand elles sont tenues', async () => {
    const kb = fakeColagan();
    const status = await vial.getUnlockStatus(kb);
    expect(status).toEqual({
      unlocked: false,
      inProgress: false,
      keys: [
        [5, 5],
        [8, 5],
      ],
    });
    await vial.unlockStart(kb);
    expect((await vial.unlockPoll(kb)).counter).toBe(50);
    kb.holdingUnlockKeys = true;
    let poll = await vial.unlockPoll(kb);
    while (!poll.unlocked) poll = await vial.unlockPoll(kb);
    expect(poll.inProgress).toBe(false);
    await vial.lock(kb);
    expect((await vial.getUnlockStatus(kb)).unlocked).toBe(false);
  });

  it('lit et écrit tap-dance, combos, key overrides et alt-repeat', async () => {
    const kb = fakeColagan();
    expect(await vial.getTapDance(kb, 0)).toEqual({
      onTap: 0,
      onHold: 0,
      onDoubleTap: 0,
      onTapHold: 0,
      tappingTerm: 200,
    });
    const td = { onTap: 0x04, onHold: 0xe1, onDoubleTap: 0x05, onTapHold: 0, tappingTerm: 180 };
    await vial.setTapDance(kb, 3, td);
    expect(await vial.getTapDance(kb, 3)).toEqual(td);

    const combo = { keys: [0x04, 0x05, 0, 0] as [number, number, number, number], output: 0x29 };
    await vial.setCombo(kb, 1, combo);
    expect(await vial.getCombo(kb, 1)).toEqual(combo);

    const ko = {
      trigger: 0x2a,
      replacement: 0x4c,
      layers: 0xffff,
      triggerMods: 2,
      negativeModMask: 0,
      suppressedMods: 2,
      options: 0x87,
    };
    await vial.setKeyOverride(kb, 0, ko);
    expect(await vial.getKeyOverride(kb, 0)).toEqual(ko);

    const ar = { keycode: 0x04, altKeycode: 0x05, allowedMods: 1, options: 8 };
    await vial.setAltRepeatKey(kb, 31, ar);
    expect(await vial.getAltRepeatKey(kb, 31)).toEqual(ar);
  });

  it('signale une entrée dynamique hors limites', async () => {
    await expect(vial.getTapDance(fakeColagan(), 40)).rejects.toThrow(ProtocolError);
  });
});

describe('VialRGB', () => {
  it('applique un mode sans l’enregistrer, puis enregistre', async () => {
    const kb = fakeColagan();
    const mode = { effect: 2, speed: 100, hue: 170, saturation: 255, value: 40 };
    await vialrgb.setRgbMode(kb, mode);
    expect(await vialrgb.getRgbMode(kb)).toEqual(mode);
    expect(kb.savedRgb.effect).toBe(14);
    await vialrgb.saveRgb(kb);
    expect(kb.savedRgb).toEqual(mode);
  });

  it('borne la luminosité au maximum du firmware', async () => {
    const kb = fakeColagan();
    await vialrgb.setRgbMode(kb, { effect: 2, speed: 0, hue: 0, saturation: 0, value: 200 });
    expect((await vialrgb.getRgbMode(kb)).value).toBe(64);
  });

  it('pagine la liste des effets supportés', async () => {
    const kb = fakeColagan();
    expect(await vialrgb.getSupportedEffects(kb)).toEqual([
      1, 2, 3, 5, 6, 13, 14, 15, 16, 17, 19, 20, 23, 24, 25, 28, 29, 30, 31, 34, 41, 42, 43,
    ]);
  });
});

describe('verrouillage VIA', () => {
  it('refuse l’écriture des macros sans déverrouillage', async () => {
    const kb = fakeColagan();
    await expect(via.writeMacroBuffer(kb, Uint8Array.of(1, 2, 3))).rejects.toThrow(ProtocolError);
    kb.unlocked = true;
    await via.writeMacroBuffer(kb, Uint8Array.of(1, 2, 3));
    expect(Array.from((await via.readMacroBuffer(kb, 4)).subarray(0, 3))).toEqual([1, 2, 3]);
  });
});
