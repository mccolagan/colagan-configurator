import { describe, expect, it } from 'vitest';
import { KeyboardClient } from '../protocol/client';
import { fakeColagan } from '../protocol/test-helpers';
import { KeyEditor, type KeyStore } from './key-editor';

class MemoryStore implements KeyStore {
  readonly keys = new Map<string, number>();
  failNext = false;
  getKey(layer: number, row: number, col: number): number {
    return this.keys.get(`${String(layer)},${String(row)},${String(col)}`) ?? 0;
  }
  setKey(layer: number, row: number, col: number, keycode: number): Promise<number> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('timeout'));
    }
    this.keys.set(`${String(layer)},${String(row)},${String(col)}`, keycode);
    return Promise.resolve(keycode);
  }
}

describe('KeyEditor', () => {
  it('écrit, annule puis rétablit', async () => {
    const store = new MemoryStore();
    const editor = new KeyEditor(store);
    await editor.assign(0, 1, 2, 0x04);
    await editor.assign(0, 1, 2, 0x05);
    expect(store.getKey(0, 1, 2)).toBe(0x05);
    await editor.undo();
    expect(store.getKey(0, 1, 2)).toBe(0x04);
    await editor.undo();
    expect(store.getKey(0, 1, 2)).toBe(0);
    expect(editor.canUndo).toBe(false);
    await editor.redo();
    expect(store.getKey(0, 1, 2)).toBe(0x04);
    expect(editor.canRedo).toBe(true);
  });

  it('une nouvelle écriture vide la pile « rétablir »', async () => {
    const editor = new KeyEditor(new MemoryStore());
    await editor.assign(0, 0, 0, 0x04);
    await editor.undo();
    await editor.assign(0, 0, 0, 0x06);
    expect(editor.canRedo).toBe(false);
  });

  it("n'enregistre rien si la valeur ne change pas", async () => {
    const editor = new KeyEditor(new MemoryStore());
    const result = await editor.assign(0, 0, 0, 0);
    expect(result.change).toBeUndefined();
    expect(editor.canUndo).toBe(false);
  });

  it("garde l'historique intact si l'écriture échoue", async () => {
    const store = new MemoryStore();
    const editor = new KeyEditor(store);
    await editor.assign(0, 0, 0, 0x04);
    store.failNext = true;
    await expect(editor.undo()).rejects.toThrow('timeout');
    expect(editor.canUndo).toBe(true);
    await editor.undo();
    expect(store.getKey(0, 0, 0)).toBe(0);
  });

  it('enchaîne les écritures dans l’ordre même lancées en parallèle', async () => {
    const store = new MemoryStore();
    const editor = new KeyEditor(store);
    await Promise.all([editor.assign(0, 0, 0, 1), editor.assign(0, 0, 0, 2), editor.undo()]);
    expect(store.getKey(0, 0, 0)).toBe(1);
  });

  it('signale QK_BOOT remplacé par KC_NO quand le clavier est verrouillé', async () => {
    const client = await KeyboardClient.connect(fakeColagan());
    const editor = new KeyEditor(client);
    const result = await editor.assign(0, 0, 0, 0x7c00);
    expect(result.stored).toBe(0);
    expect(result.change?.after).toBe(0);
  });
});
