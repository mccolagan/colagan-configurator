import { describe, expect, it } from 'vitest';
import { FakeKeyboard } from '../protocol/fake-keyboard';
import { fakeColagan, fixtureDefinition, fixtureVil } from '../protocol/test-helpers';
import { LedPreview, type LedPaints, type PreviewState } from './led-preview';

function setup(kb: FakeKeyboard = fakeColagan()) {
  const frames: LedPaints[] = [];
  const states: PreviewState[] = [];
  const preview = new LedPreview(kb, {
    isHidden: () => false,
    onFrame: (paints) => frames.push(paints),
    onState: (state) => states.push(state),
  });
  return { kb, preview, frames, states };
}

describe('LedPreview', () => {
  it('colore chaque touche à partir de sa position matricielle', async () => {
    const { kb, preview, frames, states } = setup();
    kb.rgb = { effect: 2, speed: 0, hue: 85, saturation: 255, value: 64 };
    await preview.poll();
    const paints = frames.at(-1);
    expect(paints?.size).toBe(58);
    expect(paints?.get('0,0')).toEqual({ kind: 'on', css: 'rgb(0 255 0)' });
    expect(paints?.get('9,4')).toEqual({ kind: 'on', css: 'rgb(0 255 0)' });
    expect(states).toEqual(['running']);
  });

  it("distingue LED éteintes et LED inconnues de l'autre moitié", async () => {
    const { kb, preview, frames, states } = setup();
    kb.rgb = { ...kb.rgb, effect: 0 };
    kb.remoteConnected = false;
    await preview.poll();
    expect(frames.at(-1)?.get('0,0')).toEqual({ kind: 'unknown' });
    expect(frames.at(-1)?.get('5,0')).toEqual({ kind: 'off' });
    expect(states).toEqual(['partial']);
  });

  it("suit l'effet en direct d'une image à l'autre", async () => {
    let now = 0;
    const kb = new FakeKeyboard({
      definition: fixtureDefinition,
      uid: fixtureVil.uid,
      layers: 8,
      rows: 10,
      cols: 6,
      clock: () => now,
    });
    const { preview, frames } = setup(kb);
    await preview.poll();
    now += 500;
    await preview.poll();
    expect(frames[0]?.get('5,0')).not.toEqual(frames[1]?.get('5,0'));
  });

  it("s'arrête définitivement sur un firmware sans la commande", async () => {
    const kb = new FakeKeyboard({
      definition: fixtureDefinition,
      uid: fixtureVil.uid,
      layers: 8,
      rows: 10,
      cols: 6,
      ledStream: false,
    });
    const { preview, frames, states } = setup(kb);
    await preview.poll();
    expect(frames).toHaveLength(0);
    expect(states).toEqual(['unsupported']);
    preview.start();
    expect(preview.active).toBe(false);
  });

  it("ignore une image arrivée après l'arrêt et efface l'aperçu", async () => {
    const { preview, frames } = setup();
    const pending = preview.poll();
    preview.stop();
    await pending;
    expect(frames).toHaveLength(1);
    expect(frames[0]?.size).toBe(0);
  });
});
