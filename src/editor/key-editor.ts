// Édition du clavier : écriture immédiate, relecture des touches, historique annuler / rétablir commun aux
// touches, macros, tap-dance et combos (l'annulation réécrit l'ancienne valeur dans le clavier).
import type { LayerColor } from '../protocol/led-stream';
import type { Combo, TapDance } from '../protocol/vial';

export interface KeyStore {
  getKey(layer: number, row: number, col: number): number;
  /** Écrit puis relit ; renvoie la valeur réellement enregistrée par le firmware. */
  setKey(layer: number, row: number, col: number, keycode: number): Promise<number>;
}

/** Écritures des entrées dynamiques ; absentes, les modifications correspondantes sont refusées. */
export interface DynamicStore {
  setTapDance(index: number, entry: TapDance): Promise<void>;
  setCombo(index: number, entry: Combo): Promise<void>;
  /** Tampon complet des macros (le déverrouillage éventuel est à la charge de l'implémentation). */
  setMacros(buffer: Uint8Array): Promise<void>;
}

/** Écriture des couleurs de couche (indice de LED -> couleur, null = transparente). */
export interface LedStore {
  setLedColors(layer: number, colors: ReadonlyMap<number, LayerColor>): Promise<void>;
}

export interface LedChange {
  readonly kind: 'leds';
  readonly layer: number;
  readonly before: ReadonlyMap<number, LayerColor>;
  readonly after: ReadonlyMap<number, LayerColor>;
}

export interface KeyChange {
  readonly kind: 'key';
  readonly layer: number;
  readonly row: number;
  readonly col: number;
  readonly before: number;
  readonly after: number;
}

export interface TapDanceChange {
  readonly kind: 'tapDance';
  readonly index: number;
  readonly before: TapDance;
  readonly after: TapDance;
}

export interface ComboChange {
  readonly kind: 'combo';
  readonly index: number;
  readonly before: Combo;
  readonly after: Combo;
}

export interface MacroChange {
  readonly kind: 'macros';
  /** Macro modifiée, pour les messages. */
  readonly index: number;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

export type Change = KeyChange | TapDanceChange | ComboChange | MacroChange | LedChange;

export interface AssignResult {
  readonly change: KeyChange | undefined;
  readonly requested: number;
  /** Valeur relue ; diffère de `requested` si le firmware l'a remplacée (QK_BOOT verrouillé -> KC_NO). */
  readonly stored: number;
}

const plain = (value: unknown): unknown =>
  value instanceof Uint8Array ? [...value] : value instanceof Map ? [...value.entries()] : value;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(plain(a)) === JSON.stringify(plain(b));

export class KeyEditor {
  private readonly done: Change[] = [];
  private readonly undone: Change[] = [];
  // les écritures partent une par une, dans l'ordre des actions
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: KeyStore,
    private readonly dynamic?: DynamicStore,
    private readonly leds?: LedStore,
  ) {}

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  /** Après un import : les valeurs « avant » de l'historique ne correspondent plus au clavier. */
  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }

  assign(layer: number, row: number, col: number, keycode: number): Promise<AssignResult> {
    return this.enqueue(async () => {
      const before = this.store.getKey(layer, row, col);
      if (before === keycode) return { change: undefined, requested: keycode, stored: keycode };
      const stored = await this.store.setKey(layer, row, col, keycode);
      const change: KeyChange | undefined =
        stored === before ? undefined : { kind: 'key', layer, row, col, before, after: stored };
      if (change) this.record(change);
      return { change, requested: keycode, stored };
    });
  }

  /** Écrit une entrée dynamique ou les macros ; rien n'est enregistré si la valeur ne change pas. */
  change(change: Exclude<Change, KeyChange>): Promise<boolean> {
    return this.enqueue(async () => {
      if (same(change.before, change.after)) return false;
      await this.write(change, 'after');
      this.record(change);
      return true;
    });
  }

  /** Réécrit l'ancienne valeur ; l'historique ne bouge que si l'écriture réussit. */
  undo(): Promise<Change | undefined> {
    return this.enqueue(async () => {
      const change = this.done.at(-1);
      if (!change) return undefined;
      await this.write(change, 'before');
      this.done.pop();
      this.undone.push(change);
      return change;
    });
  }

  redo(): Promise<Change | undefined> {
    return this.enqueue(async () => {
      const change = this.undone.at(-1);
      if (!change) return undefined;
      await this.write(change, 'after');
      this.undone.pop();
      this.done.push(change);
      return change;
    });
  }

  private record(change: Change): void {
    this.done.push(change);
    this.undone.length = 0;
  }

  private async write(change: Change, side: 'before' | 'after'): Promise<void> {
    if (change.kind === 'key') {
      await this.store.setKey(change.layer, change.row, change.col, change[side]);
      return;
    }
    if (change.kind === 'leds') {
      if (!this.leds) throw new Error('Écriture non prise en charge');
      await this.leds.setLedColors(change.layer, change[side]);
      return;
    }
    const dynamic = this.dynamic;
    if (!dynamic) throw new Error('Écriture non prise en charge');
    if (change.kind === 'tapDance') await dynamic.setTapDance(change.index, change[side]);
    else if (change.kind === 'combo') await dynamic.setCombo(change.index, change[side]);
    else await dynamic.setMacros(change[side]);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
