// Édition des touches : écriture immédiate dans le clavier, relecture, historique annuler / rétablir.

export interface KeyStore {
  getKey(layer: number, row: number, col: number): number;
  /** Écrit puis relit ; renvoie la valeur réellement enregistrée par le firmware. */
  setKey(layer: number, row: number, col: number, keycode: number): Promise<number>;
}

export interface KeyChange {
  readonly layer: number;
  readonly row: number;
  readonly col: number;
  readonly before: number;
  readonly after: number;
}

export interface AssignResult {
  readonly change: KeyChange | undefined;
  readonly requested: number;
  /** Valeur relue ; diffère de `requested` si le firmware l'a remplacée (QK_BOOT verrouillé -> KC_NO). */
  readonly stored: number;
}

export class KeyEditor {
  private readonly done: KeyChange[] = [];
  private readonly undone: KeyChange[] = [];
  // les écritures partent une par une, dans l'ordre des actions
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: KeyStore) {}

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  assign(layer: number, row: number, col: number, keycode: number): Promise<AssignResult> {
    return this.enqueue(async () => {
      const before = this.store.getKey(layer, row, col);
      if (before === keycode) return { change: undefined, requested: keycode, stored: keycode };
      const stored = await this.store.setKey(layer, row, col, keycode);
      const change = stored === before ? undefined : { layer, row, col, before, after: stored };
      if (change) {
        this.done.push(change);
        this.undone.length = 0;
      }
      return { change, requested: keycode, stored };
    });
  }

  /** Réécrit l'ancienne valeur ; l'historique ne bouge que si l'écriture réussit. */
  undo(): Promise<KeyChange | undefined> {
    return this.enqueue(async () => {
      const change = this.done.at(-1);
      if (!change) return undefined;
      await this.store.setKey(change.layer, change.row, change.col, change.before);
      this.done.pop();
      this.undone.push(change);
      return change;
    });
  }

  redo(): Promise<KeyChange | undefined> {
    return this.enqueue(async () => {
      const change = this.undone.at(-1);
      if (!change) return undefined;
      await this.store.setKey(change.layer, change.row, change.col, change.after);
      this.undone.pop();
      this.done.push(change);
      return change;
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
