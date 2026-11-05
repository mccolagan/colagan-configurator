// Commandes VIA (vial-qmk quantum/via.h). Valeurs multi-octets en big-endian.
import { packet, ProtocolError, readU16be, u16be, type Transport } from './packet';

export const ViaCommand = {
  getProtocolVersion: 0x01,
  getKeyboardValue: 0x02,
  setKeyboardValue: 0x03,
  getKeycode: 0x04,
  setKeycode: 0x05,
  keymapReset: 0x06,
  lightingSetValue: 0x07,
  lightingGetValue: 0x08,
  lightingSave: 0x09,
  eepromReset: 0x0a,
  bootloaderJump: 0x0b,
  macroGetCount: 0x0c,
  macroGetBufferSize: 0x0d,
  macroGetBuffer: 0x0e,
  macroSetBuffer: 0x0f,
  macroReset: 0x10,
  getLayerCount: 0x11,
  keymapGetBuffer: 0x12,
  keymapSetBuffer: 0x13,
  vialPrefix: 0xfe,
  unhandled: 0xff,
} as const;

/** Charge utile maximale d'un transfert de buffer (32 - commande - offset 2 o - taille). */
export const BUFFER_CHUNK = 28;

/** Envoie une commande VIA ; le firmware renvoie 0xFF en premier octet s'il l'a refusée. */
export async function viaCommand(transport: Transport, ...bytes: number[]): Promise<Uint8Array> {
  const response = await transport.request(packet(...bytes));
  if (response[0] === ViaCommand.unhandled && bytes[0] !== ViaCommand.unhandled) {
    throw new ProtocolError(
      `Commande 0x${(bytes[0] ?? 0).toString(16)} refusée par le clavier (inconnue ou clavier verrouillé)`,
    );
  }
  return response;
}

export async function getProtocolVersion(t: Transport): Promise<number> {
  return readU16be(await viaCommand(t, ViaCommand.getProtocolVersion), 1);
}

export async function getLayerCount(t: Transport): Promise<number> {
  return (await viaCommand(t, ViaCommand.getLayerCount))[1] ?? 0;
}

export async function getKeycode(t: Transport, layer: number, row: number, col: number): Promise<number> {
  return readU16be(await viaCommand(t, ViaCommand.getKeycode, layer, row, col), 4);
}

export async function setKeycode(
  t: Transport,
  layer: number,
  row: number,
  col: number,
  keycode: number,
): Promise<void> {
  await viaCommand(t, ViaCommand.setKeycode, layer, row, col, ...u16be(keycode));
}

async function readBuffer(t: Transport, command: number, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += BUFFER_CHUNK) {
    const chunk = Math.min(BUFFER_CHUNK, size - offset);
    const response = await viaCommand(t, command, ...u16be(offset), chunk);
    out.set(response.subarray(4, 4 + chunk), offset);
  }
  return out;
}

async function writeBuffer(t: Transport, command: number, data: Uint8Array): Promise<void> {
  for (let offset = 0; offset < data.length; offset += BUFFER_CHUNK) {
    const chunk = data.subarray(offset, offset + BUFFER_CHUNK);
    await viaCommand(t, command, ...u16be(offset), chunk.length, ...chunk);
  }
}

/** Keymap complète [couche][ligne][colonne], lue en bloc. */
export async function readKeymap(
  t: Transport,
  layers: number,
  rows: number,
  cols: number,
): Promise<Uint16Array> {
  const bytes = await readBuffer(t, ViaCommand.keymapGetBuffer, layers * rows * cols * 2);
  const keymap = new Uint16Array(layers * rows * cols);
  for (let i = 0; i < keymap.length; i++) keymap[i] = readU16be(bytes, i * 2);
  return keymap;
}

export async function writeKeymap(t: Transport, keymap: Uint16Array): Promise<void> {
  const bytes = new Uint8Array(keymap.length * 2);
  keymap.forEach((code, i) => {
    bytes.set(u16be(code), i * 2);
  });
  await writeBuffer(t, ViaCommand.keymapSetBuffer, bytes);
}

export async function getMacroCount(t: Transport): Promise<number> {
  return (await viaCommand(t, ViaCommand.macroGetCount))[1] ?? 0;
}

export async function getMacroBufferSize(t: Transport): Promise<number> {
  return readU16be(await viaCommand(t, ViaCommand.macroGetBufferSize), 1);
}

export async function readMacroBuffer(t: Transport, size: number): Promise<Uint8Array> {
  return readBuffer(t, ViaCommand.macroGetBuffer, size);
}

/** Écriture des macros : exige le déverrouillage Vial. */
export async function writeMacroBuffer(t: Transport, data: Uint8Array): Promise<void> {
  await writeBuffer(t, ViaCommand.macroSetBuffer, data);
}

export async function keymapReset(t: Transport): Promise<void> {
  await viaCommand(t, ViaCommand.keymapReset);
}

export async function eepromReset(t: Transport): Promise<void> {
  await viaCommand(t, ViaCommand.eepromReset);
}

/** Exige le déverrouillage Vial ; le clavier se fige en mode flash (pas de réponse attendue). */
export async function bootloaderJump(t: Transport): Promise<void> {
  await t.request(packet(ViaCommand.bootloaderJump));
}
