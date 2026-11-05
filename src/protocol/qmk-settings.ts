// Réglages QMK de Vial (0xFE 0x09..0x0B) : identifiants « qsid », valeurs little-endian de 1, 2 ou 4 octets.
import { packet, ProtocolError, readU16le, u16le, type Transport } from './packet';
import { ViaCommand } from './via';
import { VialCommand } from './vial';

/**
 * Largeur en octets de chaque qsid connu de vial-gui (resources/base/qmk_settings.json, 1 par défaut).
 * Un qsid absent de cette table n'est ni lu ni écrit, comme dans Vial.
 */
export const QSID_WIDTHS: ReadonlyMap<number, number> = new Map([
  [1, 1],
  [2, 2],
  [3, 1],
  [4, 2],
  [5, 1],
  [6, 2],
  [7, 2],
  [8, 1],
  [9, 2],
  [10, 2],
  [11, 2],
  [12, 2],
  [13, 2],
  [14, 2],
  [15, 2],
  [16, 2],
  [17, 2],
  [18, 2],
  [19, 2],
  [20, 1],
  [21, 4],
  [22, 1],
  [23, 1],
  [24, 1],
  [25, 2],
  [26, 1],
  [27, 2],
]);

const vial = (t: Transport, ...bytes: number[]): Promise<Uint8Array> =>
  t.request(packet(ViaCommand.vialPrefix, ...bytes));

/** qsids gérés par le firmware, lus par pages (« supérieurs à cur ») jusqu'au marqueur 0xFFFF. */
export async function querySupportedSettings(t: Transport): Promise<number[]> {
  const supported = new Set<number>();
  let cur = 0;
  while (cur !== 0xffff) {
    const r = await vial(t, VialCommand.qmkSettingsQuery, ...u16le(cur));
    let next = cur;
    for (let i = 0; i + 1 < r.length; i += 2) {
      const qsid = readU16le(r, i);
      next = Math.max(next, qsid);
      if (qsid !== 0xffff) supported.add(qsid);
    }
    if (next === cur) break;
    cur = next;
  }
  return [...supported].sort((a, b) => a - b);
}

export async function getSetting(t: Transport, qsid: number): Promise<number | undefined> {
  const width = QSID_WIDTHS.get(qsid);
  if (width === undefined) return undefined;
  const r = await vial(t, VialCommand.qmkSettingsGet, ...u16le(qsid));
  if (r[0] !== 0) return undefined;
  let value = 0;
  for (let i = width - 1; i >= 0; i--) value = value * 256 + (r[1 + i] ?? 0);
  return value;
}

export async function setSetting(t: Transport, qsid: number, value: number): Promise<void> {
  const width = QSID_WIDTHS.get(qsid);
  if (width === undefined) throw new ProtocolError(`Réglage QMK ${String(qsid)} inconnu`);
  const bytes = Array.from({ length: width }, (_, i) => Math.floor(value / 256 ** i) % 256);
  const r = await vial(t, VialCommand.qmkSettingsSet, ...u16le(qsid), ...bytes);
  if (r[0] !== 0) throw new ProtocolError(`Réglage QMK ${String(qsid)} refusé (statut ${String(r[0])})`);
}

/** Lecture de tous les réglages gérés, dans l'ordre croissant des qsid (ordre du .vil de Vial). */
export async function readSettings(t: Transport): Promise<Map<number, number>> {
  const settings = new Map<number, number>();
  for (const qsid of await querySupportedSettings(t)) {
    const value = await getSetting(t, qsid);
    if (value !== undefined) settings.set(qsid, value);
  }
  return settings;
}
