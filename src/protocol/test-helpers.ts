// Construction d'un faux Colagan V2 à partir des fixtures réelles (tests uniquement).
import { readFileSync } from 'node:fs';
import { parseVil } from '../io/vil';
import { KeycodeCatalog } from '../keycodes/catalog';
import { FakeKeyboard } from './fake-keyboard';

export const fixtureVil = parseVil(readFileSync('tests/fixtures/colagan-v2-default.vil', 'utf8'));
export const fixtureDefinition = new Uint8Array(readFileSync('tests/fixtures/colagan-v2-definition.xz'));

export const colaganCatalog = new KeycodeCatalog({
  layers: 8,
  macroCount: 16,
  tapDanceCount: 32,
  customKeycodes: [{ name: 'SEL x3', title: 'Sélecteur de couche', shortName: 'SELx3' }],
});

/** Keymap de la fixture en valeurs ; -1 (position sans touche) devient KC_NO comme dans le firmware. */
export function fixtureKeymap(): Uint16Array {
  return Uint16Array.from(
    fixtureVil.layout.flat(2).map((name) => (name === -1 ? 0 : colaganCatalog.deserialize(name))),
  );
}

export function fakeColagan(): FakeKeyboard {
  return new FakeKeyboard({
    definition: fixtureDefinition,
    uid: fixtureVil.uid,
    layers: 8,
    rows: 10,
    cols: 6,
    keymap: fixtureKeymap(),
  });
}
