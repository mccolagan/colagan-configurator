// Commandes Vial (préfixe 0xFE, vial-qmk quantum/vial.h / vial.c). Valeurs multi-octets en little-endian.
import {
  packet,
  ProtocolError,
  readU16le,
  readU32le,
  readU64le,
  REPORT_SIZE,
  u16le,
  type Transport,
} from './packet';
import { ViaCommand } from './via';

export const VialCommand = {
  getKeyboardId: 0x00,
  getSize: 0x01,
  getDefinition: 0x02,
  getUnlockStatus: 0x05,
  unlockStart: 0x06,
  unlockPoll: 0x07,
  lock: 0x08,
  qmkSettingsQuery: 0x09,
  qmkSettingsGet: 0x0a,
  qmkSettingsSet: 0x0b,
  qmkSettingsReset: 0x0c,
  dynamicEntryOp: 0x0d,
} as const;

export const DynamicEntryOp = {
  getCounts: 0x00,
  tapDanceGet: 0x01,
  tapDanceSet: 0x02,
  comboGet: 0x03,
  comboSet: 0x04,
  keyOverrideGet: 0x05,
  keyOverrideSet: 0x06,
  altRepeatKeyGet: 0x07,
  altRepeatKeySet: 0x08,
} as const;

async function vial(t: Transport, ...bytes: number[]): Promise<Uint8Array> {
  return t.request(packet(ViaCommand.vialPrefix, ...bytes));
}

export interface KeyboardId {
  readonly protocol: number;
  readonly uid: bigint;
  readonly vialRgb: boolean;
}

export async function getKeyboardId(t: Transport): Promise<KeyboardId> {
  const r = await vial(t, VialCommand.getKeyboardId);
  return { protocol: readU32le(r, 0), uid: readU64le(r, 4), vialRgb: r[12] === 1 };
}

/** Définition compressée (XZ) lue par pages de 32 octets. */
export async function readCompressedDefinition(t: Transport): Promise<Uint8Array> {
  const size = readU32le(await vial(t, VialCommand.getSize), 0);
  if (size === 0 || size > 1 << 20)
    throw new ProtocolError(`Taille de définition invalide (${String(size)})`);
  const out = new Uint8Array(size);
  for (let page = 0; page * REPORT_SIZE < size; page++) {
    const r = await vial(t, VialCommand.getDefinition, ...u16le(page));
    out.set(r.subarray(0, Math.min(REPORT_SIZE, size - page * REPORT_SIZE)), page * REPORT_SIZE);
  }
  return out;
}

export interface UnlockStatus {
  readonly unlocked: boolean;
  readonly inProgress: boolean;
  /** Touches [ligne, colonne] à tenir pour déverrouiller. */
  readonly keys: readonly (readonly [number, number])[];
}

export async function getUnlockStatus(t: Transport): Promise<UnlockStatus> {
  const r = await vial(t, VialCommand.getUnlockStatus);
  const keys: [number, number][] = [];
  for (let i = 2; i + 1 < r.length; i += 2) {
    const row = r[i] ?? 0xff;
    const col = r[i + 1] ?? 0xff;
    if (row === 0xff || col === 0xff) break;
    keys.push([row, col]);
  }
  return { unlocked: r[0] === 1, inProgress: r[1] === 1, keys };
}

export async function unlockStart(t: Transport): Promise<void> {
  await vial(t, VialCommand.unlockStart);
}

export interface UnlockPoll {
  readonly unlocked: boolean;
  readonly inProgress: boolean;
  /** Décompte restant (part de 50, décrémenté toutes les 100 ms tant que les touches sont tenues). */
  readonly counter: number;
}

export async function unlockPoll(t: Transport): Promise<UnlockPoll> {
  const r = await vial(t, VialCommand.unlockPoll);
  return { unlocked: r[0] === 1, inProgress: r[1] === 1, counter: r[2] ?? 0 };
}

export async function lock(t: Transport): Promise<void> {
  await vial(t, VialCommand.lock);
}

export interface DynamicCounts {
  readonly tapDance: number;
  readonly combo: number;
  readonly keyOverride: number;
  readonly altRepeatKey: number;
  readonly capsWord: boolean;
  readonly layerLock: boolean;
}

export async function getDynamicCounts(t: Transport): Promise<DynamicCounts> {
  const r = await vial(t, VialCommand.dynamicEntryOp, DynamicEntryOp.getCounts);
  const features = r[REPORT_SIZE - 1] ?? 0;
  return {
    tapDance: r[0] ?? 0,
    combo: r[1] ?? 0,
    keyOverride: r[2] ?? 0,
    altRepeatKey: r[3] ?? 0,
    capsWord: (features & 1) !== 0,
    layerLock: (features & 2) !== 0,
  };
}

async function dynamicGet(t: Transport, op: number, index: number, size: number): Promise<Uint8Array> {
  const r = await vial(t, VialCommand.dynamicEntryOp, op, index);
  if (r[0] !== 0)
    throw new ProtocolError(`Entrée dynamique ${String(index)} illisible (statut ${String(r[0])})`);
  return r.slice(1, 1 + size);
}

async function dynamicSet(t: Transport, op: number, index: number, data: readonly number[]): Promise<void> {
  const r = await vial(t, VialCommand.dynamicEntryOp, op, index, ...data);
  if (r[0] !== 0)
    throw new ProtocolError(`Écriture de l'entrée ${String(index)} refusée (statut ${String(r[0])})`);
}

const words = (data: Uint8Array, count: number): number[] =>
  Array.from({ length: count }, (_, i) => readU16le(data, i * 2));

export interface TapDance {
  onTap: number;
  onHold: number;
  onDoubleTap: number;
  onTapHold: number;
  tappingTerm: number;
}

export async function getTapDance(t: Transport, index: number): Promise<TapDance> {
  const [onTap = 0, onHold = 0, onDoubleTap = 0, onTapHold = 0, tappingTerm = 0] = words(
    await dynamicGet(t, DynamicEntryOp.tapDanceGet, index, 10),
    5,
  );
  return { onTap, onHold, onDoubleTap, onTapHold, tappingTerm };
}

export async function setTapDance(t: Transport, index: number, td: TapDance): Promise<void> {
  const values = [td.onTap, td.onHold, td.onDoubleTap, td.onTapHold, td.tappingTerm];
  await dynamicSet(t, DynamicEntryOp.tapDanceSet, index, values.flatMap(u16le));
}

export interface Combo {
  keys: [number, number, number, number];
  output: number;
}

export async function getCombo(t: Transport, index: number): Promise<Combo> {
  const [k1 = 0, k2 = 0, k3 = 0, k4 = 0, output = 0] = words(
    await dynamicGet(t, DynamicEntryOp.comboGet, index, 10),
    5,
  );
  return { keys: [k1, k2, k3, k4], output };
}

export async function setCombo(t: Transport, index: number, combo: Combo): Promise<void> {
  await dynamicSet(t, DynamicEntryOp.comboSet, index, [...combo.keys, combo.output].flatMap(u16le));
}

export interface KeyOverride {
  trigger: number;
  replacement: number;
  layers: number;
  triggerMods: number;
  negativeModMask: number;
  suppressedMods: number;
  options: number;
}

export async function getKeyOverride(t: Transport, index: number): Promise<KeyOverride> {
  const d = await dynamicGet(t, DynamicEntryOp.keyOverrideGet, index, 10);
  return {
    trigger: readU16le(d, 0),
    replacement: readU16le(d, 2),
    layers: readU16le(d, 4),
    triggerMods: d[6] ?? 0,
    negativeModMask: d[7] ?? 0,
    suppressedMods: d[8] ?? 0,
    options: d[9] ?? 0,
  };
}

export async function setKeyOverride(t: Transport, index: number, ko: KeyOverride): Promise<void> {
  await dynamicSet(t, DynamicEntryOp.keyOverrideSet, index, [
    ...u16le(ko.trigger),
    ...u16le(ko.replacement),
    ...u16le(ko.layers),
    ko.triggerMods,
    ko.negativeModMask,
    ko.suppressedMods,
    ko.options,
  ]);
}

export interface AltRepeatKey {
  keycode: number;
  altKeycode: number;
  allowedMods: number;
  options: number;
}

export async function getAltRepeatKey(t: Transport, index: number): Promise<AltRepeatKey> {
  const d = await dynamicGet(t, DynamicEntryOp.altRepeatKeyGet, index, 6);
  return {
    keycode: readU16le(d, 0),
    altKeycode: readU16le(d, 2),
    allowedMods: d[4] ?? 0,
    options: d[5] ?? 0,
  };
}

export async function setAltRepeatKey(t: Transport, index: number, ar: AltRepeatKey): Promise<void> {
  await dynamicSet(t, DynamicEntryOp.altRepeatKeySet, index, [
    ...u16le(ar.keycode),
    ...u16le(ar.altKeycode),
    ar.allowedMods,
    ar.options,
  ]);
}
