import { describe, expect, it } from 'vitest';
import type { Transport } from '../protocol/packet';
import { fakeColagan } from '../protocol/test-helpers';
import { RgbController } from './rgb-controller';

/** Compte les envois 0x07 (lightingSetValue) qui passent par le transport. */
function counting(transport: Transport): Transport & { sets: number } {
  const wrapper = {
    sets: 0,
    request(report: Uint8Array): Promise<Uint8Array> {
      if (report[0] === 0x07) wrapper.sets++;
      return transport.request(report);
    },
  };
  return wrapper;
}

const initial = { effect: 14, speed: 60, hue: 0, saturation: 255, value: 40 };

describe('RgbController', () => {
  it('envoie le changement immédiatement au clavier', async () => {
    const keyboard = fakeColagan();
    const rgb = new RgbController(keyboard, initial, { maxBrightness: 64 });
    rgb.update({ effect: 2, hue: 85 });
    await rgb.flush();
    expect(keyboard.rgb).toMatchObject({ effect: 2, hue: 85 });
    expect(rgb.dirty).toBe(true);
  });

  it('limite le débit mais garantit le dernier état', async () => {
    const keyboard = fakeColagan();
    const transport = counting(keyboard);
    const rgb = new RgbController(transport, initial, { maxBrightness: 64, interval: 20 });
    for (let hue = 1; hue <= 50; hue++) rgb.update({ hue });
    await rgb.flush();
    expect(keyboard.rgb.hue).toBe(50);
    expect(transport.sets).toBeLessThanOrEqual(3);
  });

  it('borne la luminosité au maximum du firmware', async () => {
    const keyboard = fakeColagan();
    const rgb = new RgbController(keyboard, initial, { maxBrightness: 64 });
    rgb.update({ value: 255 });
    await rgb.flush();
    expect(keyboard.rgb.value).toBe(64);
  });

  it('enregistre dans l’EEPROM puis n’est plus « modifié »', async () => {
    const keyboard = fakeColagan();
    const rgb = new RgbController(keyboard, initial, { maxBrightness: 64 });
    rgb.update({ effect: 6 });
    await rgb.save();
    expect(keyboard.savedRgb.effect).toBe(6);
    expect(rgb.dirty).toBe(false);
  });

  it('« Rétablir » revient au dernier état enregistré', async () => {
    const keyboard = fakeColagan();
    const rgb = new RgbController(keyboard, initial, { maxBrightness: 64 });
    rgb.update({ effect: 2, value: 10 });
    await rgb.revert();
    expect(keyboard.rgb).toMatchObject(initial);
    expect(rgb.dirty).toBe(false);
  });
});
