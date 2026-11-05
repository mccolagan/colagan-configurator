// Mode démo : un Colagan V2 simulé (définition et keymap réelles), sans matériel ni WebHID.
import vilText from '../../tests/fixtures/colagan-v2-default.vil?raw';
import definitionUrl from '../../tests/fixtures/colagan-v2-definition.xz?url';
import { parseVil } from '../io/vil';
import { KeycodeCatalog } from '../keycodes/catalog';
import { decodeDefinition } from '../protocol/definition';
import { FakeKeyboard } from '../protocol/fake-keyboard';
import { COLAGAN_DEFAULT_LAYER_COLORS } from '../profiles/colagan-layer-colors';

export async function createDemoKeyboard(): Promise<FakeKeyboard> {
  const response = await fetch(definitionUrl);
  const compressed = new Uint8Array(await response.arrayBuffer());
  const definition = await decodeDefinition(compressed);
  const vil = parseVil(vilText);
  const layers = vil.layout.length;
  const catalog = new KeycodeCatalog({
    layers,
    macroCount: vil.macro.length,
    tapDanceCount: vil.tap_dance.length,
    customKeycodes: definition.customKeycodes ?? [],
  });
  const keymap = Uint16Array.from(
    vil.layout.flat(2).map((name) => (name === -1 ? 0 : catalog.deserialize(name))),
  );
  const keyboard = new FakeKeyboard({
    definition: compressed,
    uid: vil.uid,
    layers,
    rows: definition.matrix.rows,
    cols: definition.matrix.cols,
    keymap,
    layerColors: COLAGAN_DEFAULT_LAYER_COLORS,
  });
  // démo : personne ne peut tenir les touches de déverrouillage, on simule qu'elles le sont
  keyboard.holdingUnlockKeys = true;
  return keyboard;
}
