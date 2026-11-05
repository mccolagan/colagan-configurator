// Macros, tap-dance et combos du clavier, lus à la demande et tenus à jour après chaque écriture.
import type { KeycodeCatalog } from '../keycodes/catalog';
import type { KeyboardClient } from '../protocol/client';
import { deserializeMacros, normalizeMacroBuffer, serializeMacros, type Macro } from '../protocol/macro';
import * as via from '../protocol/via';
import * as vial from '../protocol/vial';
import type { DynamicStore } from './key-editor';

export class UnlockRefusedError extends Error {
  override readonly name = 'UnlockRefusedError';
}

export class DynamicState implements DynamicStore {
  private constructor(
    private readonly client: KeyboardClient,
    private readonly catalog: KeycodeCatalog,
    private readonly ensureUnlocked: () => Promise<boolean>,
    private buffer: Uint8Array,
    readonly tapDance: vial.TapDance[],
    readonly combos: vial.Combo[],
  ) {}

  static async load(
    client: KeyboardClient,
    catalog: KeycodeCatalog,
    ensureUnlocked: () => Promise<boolean>,
  ): Promise<DynamicState> {
    const t = client.transport;
    const { macroCount, macroBufferSize, dynamic } = client.info;
    const raw = macroBufferSize ? await via.readMacroBuffer(t, macroBufferSize) : new Uint8Array(0);
    const tapDance: vial.TapDance[] = [];
    for (let i = 0; i < dynamic.tapDance; i++) tapDance.push(await vial.getTapDance(t, i));
    const combos: vial.Combo[] = [];
    for (let i = 0; i < dynamic.combo; i++) combos.push(await vial.getCombo(t, i));
    return new DynamicState(
      client,
      catalog,
      ensureUnlocked,
      normalizeMacroBuffer(raw, macroCount),
      tapDance,
      combos,
    );
  }

  get macroBuffer(): Uint8Array {
    return this.buffer;
  }

  get macroCapacity(): number {
    return this.client.info.macroBufferSize;
  }

  macros(): Macro[] {
    return deserializeMacros(this.buffer, this.client.info.macroCount, this.catalog);
  }

  /** Tampon complet avec la macro `index` remplacée (peut dépasser la capacité : à vérifier avant écriture). */
  bufferWith(index: number, macro: Macro): Uint8Array {
    const list = this.macros();
    list[index] = macro;
    return serializeMacros(list, this.client.info.macroCount, this.catalog);
  }

  async setTapDance(index: number, entry: vial.TapDance): Promise<void> {
    await vial.setTapDance(this.client.transport, index, entry);
    this.tapDance[index] = { ...entry };
  }

  async setCombo(index: number, entry: vial.Combo): Promise<void> {
    await vial.setCombo(this.client.transport, index, entry);
    this.combos[index] = { keys: [...entry.keys], output: entry.output };
  }

  async setMacros(buffer: Uint8Array): Promise<void> {
    if (buffer.length > this.macroCapacity) {
      throw new RangeError(`${String(buffer.length)} octets pour ${String(this.macroCapacity)} disponibles`);
    }
    if (!(await this.ensureUnlocked())) throw new UnlockRefusedError('déverrouillage annulé');
    await via.writeMacroBuffer(this.client.transport, buffer);
    this.buffer = buffer.slice();
  }
}
