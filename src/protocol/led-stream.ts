// Lecture des couleurs réelles des LED (commande firmware 0xC0, propre au Colagan V2).
// Spécification : colagan-pico-split-keyboard/docs/led-stream-protocol.md
import { packet, ProtocolError, readU16le, u16le, type Transport } from './packet';
import type { RgbMode } from './vialrgb';

export const LED_STREAM_COMMAND = 0xc0;
const MARKER = 0xff;
const SUPPORTED_VERSIONS = [1, 2];

const Sub = {
  info: 0x00,
  positions: 0x01,
  colors: 0x02,
  layerGet: 0x03,
  layerSet: 0x04,
  effectGet: 0x05,
  effectSet: 0x06,
  preview: 0x07,
  layerReset: 0x08,
} as const;

/** LED par lecture / écriture de couleurs de couche. */
export const LAYER_RANGE = 8;
export const NO_LAYER = 0xff;

export const LedStatus = {
  ok: 0x00,
  unknownSub: 0x01,
  outOfRange: 0x02,
  badRequest: 0x03,
  remoteUnavailable: 0x10,
  remoteMismatch: 0x11,
  /** Requête renvoyée telle quelle : déverrouillage Vial en cours. */
  echo: 0xff,
} as const;

/** Le firmware ne connaît pas la commande (ancien firmware, autre clavier). */
export class LedStreamUnsupported extends ProtocolError {}

/** Réponse ignorée (déverrouillage Vial en cours) : réessayer plus tard. */
export class LedStreamBusy extends ProtocolError {}

export interface LedStreamInfo {
  readonly version: number;
  readonly ledCount: number;
  readonly colorsPerPacket: number;
  readonly positionsPerPacket: number;
  /** LED 0 … leftCount-1 = moitié gauche, le reste = droite. */
  readonly leftCount: number;
  readonly masterIsLeft: boolean;
  readonly remoteConnected: boolean;
  readonly rgbEnabled: boolean;
  readonly maxBrightness: number;
  readonly value: number;
  /** v2 : couleurs et effet par couche modifiables (0 sinon). */
  readonly layerCount: number;
  /** v2 : couche de frappe active sur le clavier. */
  readonly activeLayer?: number;
  /** v2 : couche en aperçu sur le clavier. */
  readonly previewLayer?: number;
}

/** Couleurs d'une couche : RGB pleine luminosité, null = transparente (laisse voir l'effet). */
export type LayerColor = readonly [number, number, number] | null;

/** Effet d'une couche ; override = false : effet global. */
export interface LayerEffect extends RgbMode {
  override: boolean;
}

export interface LedFrame {
  /** R, G, B par LED, valeurs PWM brutes (luminosité incluse). */
  readonly colors: Uint8Array;
  /** LED dont la couleur n'a pas pu être lue (autre moitié injoignable ou sans ce firmware). */
  readonly unknown: readonly boolean[];
  readonly status: number;
}

async function request(t: Transport, sub: number, start = 0, ...rest: number[]): Promise<Uint8Array> {
  const r = await t.request(packet(LED_STREAM_COMMAND, sub, MARKER, start, ...rest));
  if (r[0] !== LED_STREAM_COMMAND) throw new LedStreamUnsupported('Commande LED 0xC0 inconnue du firmware');
  const status = r[2];
  if (status === LedStatus.echo) throw new LedStreamBusy('Clavier occupé (déverrouillage en cours)');
  if (status !== undefined && status !== LedStatus.ok && status < LedStatus.remoteUnavailable) {
    throw new ProtocolError(`Commande LED refusée (statut 0x${status.toString(16)})`);
  }
  return r;
}

export async function getLedStreamInfo(t: Transport): Promise<LedStreamInfo> {
  const r = await request(t, Sub.info);
  const d = (i: number): number => r[3 + i] ?? 0;
  if (!SUPPORTED_VERSIONS.includes(d(0))) {
    throw new LedStreamUnsupported(`Protocole LED v${String(d(0))} non pris en charge`);
  }
  const flags = d(6);
  return {
    version: d(0),
    ledCount: d(1),
    colorsPerPacket: d(2),
    positionsPerPacket: d(3),
    leftCount: d(4),
    masterIsLeft: d(5) === 0,
    remoteConnected: (flags & 0x02) !== 0,
    rgbEnabled: (flags & 0x04) !== 0,
    maxBrightness: d(7),
    value: d(8),
    layerCount: d(0) >= 2 && flags & 0x08 ? d(11) : 0,
    ...(d(0) >= 2 ? { activeLayer: d(12), previewLayer: d(13) } : {}),
  };
}

/** Couleurs des `ledCount` LED d'une couche. */
export async function getLayerColors(t: Transport, layer: number, ledCount: number): Promise<LayerColor[]> {
  const colors: LayerColor[] = [];
  while (colors.length < ledCount) {
    const r = await request(t, Sub.layerGet, colors.length, layer);
    const count = r[5] ?? 0;
    const mask = r[6] ?? 0;
    if (!count) throw new ProtocolError('Réponse de couleurs de couche vide');
    for (let i = 0; i < count; i++) {
      const o = 7 + 3 * i;
      colors.push(mask & (1 << i) ? null : [r[o] ?? 0, r[o + 1] ?? 0, r[o + 2] ?? 0]);
    }
  }
  return colors;
}

/** Écrit des LED d'une couche (indice -> couleur), regroupées en plages contiguës de 8 LED max. */
export async function setLayerColors(
  t: Transport,
  layer: number,
  colors: ReadonlyMap<number, LayerColor>,
): Promise<void> {
  const leds = [...colors.keys()].sort((a, b) => a - b);
  for (let i = 0; i < leds.length;) {
    const start = leds[i] ?? 0;
    let count = 1;
    while (count < LAYER_RANGE && leds[i + count] === start + count) count++;
    let mask = 0;
    const rgb: number[] = [];
    for (let k = 0; k < count; k++) {
      const color = colors.get(start + k) ?? null;
      if (color === null) mask |= 1 << k;
      rgb.push(...(color ?? [0, 0, 0]));
    }
    await request(t, Sub.layerSet, start, layer, count, mask, ...rgb);
    i += count;
  }
}

export async function getLayerEffect(t: Transport, layer: number): Promise<LayerEffect> {
  const r = await request(t, Sub.effectGet, 0, layer);
  return {
    override: (r[5] ?? 0) !== 0,
    effect: readU16le(r, 6),
    speed: r[8] ?? 0,
    hue: r[9] ?? 0,
    saturation: r[10] ?? 0,
    value: r[11] ?? 0,
  };
}

export async function setLayerEffect(t: Transport, layer: number, e: LayerEffect): Promise<void> {
  await request(
    t,
    Sub.effectSet,
    0,
    layer,
    e.override ? 1 : 0,
    ...u16le(e.effect),
    e.speed,
    e.hue,
    e.saturation,
    e.value,
  );
}

/** Le clavier affiche l'éclairage de `layer` pendant 3 s (à renouveler) ; null = arrêter. */
export async function setPreviewLayer(t: Transport, layer: number | null): Promise<void> {
  await request(t, Sub.preview, 0, layer ?? NO_LAYER);
}

/** Couleurs et effet par défaut (compilés) ; layer = nombre de couches pour toutes. */
export async function resetLayer(t: Transport, layer: number): Promise<void> {
  await request(t, Sub.layerReset, 0, layer);
}

/** Position matricielle de chaque LED ([0xFF, 0xFF] = LED sans touche). */
export async function getLedPositions(t: Transport, info: LedStreamInfo): Promise<[number, number][]> {
  const positions: [number, number][] = [];
  while (positions.length < info.ledCount) {
    const r = await request(t, Sub.positions, positions.length);
    const count = r[4] ?? 0;
    if (!count) throw new ProtocolError('Réponse de positions LED vide');
    for (let i = 0; i < count; i++) positions.push([r[5 + 2 * i] ?? 0xff, r[6 + 2 * i] ?? 0xff]);
  }
  return positions;
}

/** Une image complète (7 requêtes pour 58 LED). */
export async function getLedFrame(t: Transport, info: LedStreamInfo): Promise<LedFrame> {
  const colors = new Uint8Array(info.ledCount * 3);
  const unknown = new Array<boolean>(info.ledCount).fill(false);
  let status: number = LedStatus.ok;
  for (let start = 0; start < info.ledCount;) {
    const r = await request(t, Sub.colors, start);
    const count = r[4] ?? 0;
    if (!count) throw new ProtocolError('Réponse de couleurs LED vide');
    colors.set(r.subarray(5, 5 + count * 3), start * 3);
    const packetStatus = r[2] ?? 0;
    if (packetStatus !== LedStatus.ok) {
      status = packetStatus;
      for (let led = start; led < start + count; led++) {
        if (led < info.leftCount !== info.masterIsLeft) unknown[led] = true;
      }
    }
    start += count;
  }
  return { colors, unknown, status };
}

/** Courbe CIE 1931 de QMK (quantum/led_tables.c) : valeur PWM maximale d'un canal à la luminosité v. */
export function cie(v: number): number {
  const lightness = (v * 100) / 255;
  const y = lightness <= 8 ? lightness / 902.3 : ((lightness + 16) / 116) ** 3;
  return Math.ceil(255 * y);
}

/** Couleur affichable : ramenée à pleine luminosité, écrêtée en gardant la teinte (voir la spec). */
export function displayColor(r: number, g: number, b: number, value: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const ref = cie(value);
  if (!max || !ref) return [0, 0, 0];
  const k = Math.min(255 / ref, 255 / max);
  return [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
}
