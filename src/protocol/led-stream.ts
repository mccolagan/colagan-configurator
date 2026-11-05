// Lecture des couleurs réelles des LED (commande firmware 0xC0, propre au Colagan V2).
// Spécification : colagan-pico-split-keyboard/docs/led-stream-protocol.md
import { packet, ProtocolError, type Transport } from './packet';

export const LED_STREAM_COMMAND = 0xc0;
const MARKER = 0xff;
const SUPPORTED_VERSION = 1;

const Sub = { info: 0x00, positions: 0x01, colors: 0x02 } as const;

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
}

export interface LedFrame {
  /** R, G, B par LED, valeurs PWM brutes (luminosité incluse). */
  readonly colors: Uint8Array;
  /** LED dont la couleur n'a pas pu être lue (autre moitié injoignable ou sans ce firmware). */
  readonly unknown: readonly boolean[];
  readonly status: number;
}

async function request(t: Transport, sub: number, start = 0): Promise<Uint8Array> {
  const r = await t.request(packet(LED_STREAM_COMMAND, sub, MARKER, start));
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
  if (d(0) !== SUPPORTED_VERSION) {
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
  };
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
