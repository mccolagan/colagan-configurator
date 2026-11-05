// VialRGB (vial-qmk quantum/vialrgb.c) : sous-commandes de 0x07 / 0x08, arguments à partir de l'octet 2.
import { packet, readU16le, u16le, type Transport } from './packet';
import { ViaCommand, viaCommand } from './via';

const VialRgbCommand = {
  getInfo: 0x40,
  getMode: 0x41,
  getSupported: 0x42,
  setMode: 0x41,
} as const;

export interface RgbInfo {
  readonly protocol: number;
  readonly maxBrightness: number;
}

/** Mode courant ; `effect` est un identifiant VialRGB (0 = éteint), pas un numéro d'effet QMK. */
export interface RgbMode {
  effect: number;
  speed: number;
  hue: number;
  saturation: number;
  value: number;
}

export async function getRgbInfo(t: Transport): Promise<RgbInfo> {
  const r = await viaCommand(t, ViaCommand.lightingGetValue, VialRgbCommand.getInfo);
  return { protocol: readU16le(r, 2), maxBrightness: r[4] ?? 0 };
}

export async function getRgbMode(t: Transport): Promise<RgbMode> {
  const r = await viaCommand(t, ViaCommand.lightingGetValue, VialRgbCommand.getMode);
  return {
    effect: readU16le(r, 2),
    speed: r[4] ?? 0,
    hue: r[5] ?? 0,
    saturation: r[6] ?? 0,
    value: r[7] ?? 0,
  };
}

/** Appliqué immédiatement, non enregistré (voir saveRgb). */
export async function setRgbMode(t: Transport, mode: RgbMode): Promise<void> {
  await viaCommand(
    t,
    ViaCommand.lightingSetValue,
    VialRgbCommand.setMode,
    ...u16le(mode.effect),
    mode.speed,
    mode.hue,
    mode.saturation,
    mode.value,
  );
}

export async function saveRgb(t: Transport): Promise<void> {
  await t.request(packet(ViaCommand.lightingSave));
}

/** Effets compilés dans le firmware (identifiants VialRGB), lus par pages jusqu'au marqueur 0xFFFF. */
export async function getSupportedEffects(t: Transport): Promise<number[]> {
  const effects: number[] = [];
  let greaterThan = 0;
  for (;;) {
    const r = await viaCommand(
      t,
      ViaCommand.lightingGetValue,
      VialRgbCommand.getSupported,
      ...u16le(greaterThan),
    );
    let added = false;
    for (let i = 2; i + 1 < r.length; i += 2) {
      const id = readU16le(r, i);
      if (id === 0xffff) break;
      effects.push(id);
      greaterThan = id;
      added = true;
    }
    if (!added) return effects;
  }
}
