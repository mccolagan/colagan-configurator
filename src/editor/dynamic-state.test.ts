import { describe, expect, it } from 'vitest';
import { KeyboardClient } from '../protocol/client';
import { colaganCatalog as catalog, fakeColagan } from '../protocol/test-helpers';
import { DynamicState, UnlockRefusedError } from './dynamic-state';
import { KeyEditor } from './key-editor';

async function setup(unlock: boolean) {
  const keyboard = fakeColagan();
  const client = await KeyboardClient.connect(keyboard);
  const state = await DynamicState.load(client, catalog, () => {
    if (unlock) keyboard.unlocked = true;
    return Promise.resolve(unlock);
  });
  return { keyboard, state, editor: new KeyEditor(client, state) };
}

describe('DynamicState + historique', () => {
  it('écrit un tap-dance, l’annule puis le rétablit dans le clavier', async () => {
    const { state, editor } = await setup(true);
    const before = state.tapDance[2];
    if (!before) throw new Error('TD(2) absent');
    const after = { ...before, onTap: 0x04, onHold: 0x5221, tappingTerm: 150 };
    expect(await editor.change({ kind: 'tapDance', index: 2, before, after })).toBe(true);
    expect(state.tapDance[2]).toEqual(after);
    await editor.undo();
    expect(state.tapDance[2]).toEqual(before);
    await editor.redo();
    expect(state.tapDance[2]).toEqual(after);
  });

  it('écrit un combo et les touches partagent le même historique', async () => {
    const { state, editor } = await setup(true);
    const before = state.combos[0];
    if (!before) throw new Error('combo 0 absent');
    await editor.assign(0, 0, 0, 0x04);
    await editor.change({
      kind: 'combo',
      index: 0,
      before,
      after: { keys: [0x0d, 0x0e, 0, 0], output: 0x29 },
    });
    const undone = await editor.undo();
    expect(undone?.kind).toBe('combo');
    expect((await editor.undo())?.kind).toBe('key');
  });

  it('enregistre une macro après déverrouillage et la relit', async () => {
    const { state, editor, keyboard } = await setup(true);
    const after = state.bufferWith(3, [
      ['text', 'gg'],
      ['tap', 'KC_ENTER'],
    ]);
    await editor.change({ kind: 'macros', index: 3, before: state.macroBuffer, after });
    expect(state.macros()[3]).toEqual([
      ['text', 'gg'],
      ['tap', 'KC_ENTER'],
    ]);
    expect(keyboard.macroBuffer.subarray(0, after.length)).toEqual(after);
  });

  it('refuse d’écrire les macros sans déverrouillage, sans toucher à l’historique', async () => {
    const { state, editor } = await setup(false);
    const after = state.bufferWith(0, [['tap', 'KC_A']]);
    await expect(
      editor.change({ kind: 'macros', index: 0, before: state.macroBuffer, after }),
    ).rejects.toThrow(UnlockRefusedError);
    expect(editor.canUndo).toBe(false);
    expect(state.macros()[0]).toEqual([]);
  });
});
