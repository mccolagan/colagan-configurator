import * as xzModule from 'xz-decompress';
import { ProtocolError } from './packet';

// Paquet CommonJS : export nommé côté Vite, sous `default` côté Node (Vitest).
type XzStreamClass = typeof xzModule.XzReadableStream;
const XzReadableStream: XzStreamClass =
  (xzModule as Partial<typeof xzModule>).XzReadableStream ??
  (xzModule as unknown as { default: { XzReadableStream: XzStreamClass } }).default.XzReadableStream;

/** Définition Vial (vial.json du firmware), décompressée. */
export interface VialDefinition {
  name?: string;
  vendorId?: string;
  productId?: string;
  lighting?: string;
  matrix: { rows: number; cols: number };
  customKeycodes?: { name?: string; title?: string; shortName?: string }[];
  layouts: { keymap: unknown[][]; labels?: unknown[] };
  [key: string]: unknown;
}

/** La définition est compressée au format XZ (vial_generate_definition.py, lzma.compress). */
export async function decodeDefinition(compressed: Uint8Array): Promise<VialDefinition> {
  let text: string;
  try {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(compressed);
        controller.close();
      },
    });
    const reader = new XzReadableStream(source).getReader();
    const chunks: Uint8Array[] = [];
    for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    text = new TextDecoder().decode(bytes);
  } catch (error) {
    throw new ProtocolError(`Définition du clavier illisible (XZ) : ${(error as Error).message}`);
  }
  const definition = JSON.parse(text) as VialDefinition;
  if (!Number.isInteger(definition.matrix.rows) || !Number.isInteger(definition.matrix.cols)) {
    throw new ProtocolError('Définition du clavier sans matrice valide');
  }
  return definition;
}
