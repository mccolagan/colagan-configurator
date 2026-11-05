/** Taille des rapports raw HID de VIA / Vial. */
export const REPORT_SIZE = 32;

/** Échange d'un rapport : envoie 32 octets, renvoie la réponse (32 octets) du clavier. */
export interface Transport {
  request(report: Uint8Array): Promise<Uint8Array>;
}

export class ProtocolError extends Error {
  override readonly name = 'ProtocolError';
}

/** Rapport de 32 octets complété par des zéros. */
export function packet(...bytes: readonly number[]): Uint8Array {
  if (bytes.length > REPORT_SIZE)
    throw new ProtocolError(`Rapport trop long (${String(bytes.length)} octets)`);
  const out = new Uint8Array(REPORT_SIZE);
  bytes.forEach((b, i) => {
    out[i] = b & 0xff;
  });
  return out;
}

export const u16be = (value: number): [number, number] => [(value >> 8) & 0xff, value & 0xff];
export const u16le = (value: number): [number, number] => [value & 0xff, (value >> 8) & 0xff];

export function readU16be(data: Uint8Array, offset: number): number {
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

export function readU16le(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

export function readU32le(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) |
      ((data[offset + 1] ?? 0) << 8) |
      ((data[offset + 2] ?? 0) << 16) |
      ((data[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

export function readU64le(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(data[offset + i] ?? 0);
  return value;
}
