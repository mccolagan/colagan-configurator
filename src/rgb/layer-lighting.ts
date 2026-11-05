// Couleurs et effet de chaque couche (firmware v2, commande 0xC0) : lus une fois, puis écrits à chaque
// modification (le clavier les enregistre immédiatement).
import { keyId } from '../ui/keyboard-view';
import type { Transport } from '../protocol/packet';
import {
  getLayerColors,
  getLayerEffect,
  getLedPositions,
  getLedStreamInfo,
  resetLayer,
  setLayerColors,
  setLayerEffect,
  type LayerColor,
  type LayerEffect,
} from '../protocol/led-stream';

export class LayerLighting {
  private constructor(
    private readonly transport: Transport,
    readonly layerCount: number,
    /** keyId -> indice de LED */
    private readonly ledOf: ReadonlyMap<string, number>,
    private readonly colors: LayerColor[][],
    private readonly effects: LayerEffect[],
  ) {}

  /** undefined si le firmware ne gère pas les couleurs par couche (v1, autre clavier). */
  static async load(transport: Transport): Promise<LayerLighting | undefined> {
    const info = await getLedStreamInfo(transport);
    if (!info.layerCount) return undefined;
    const positions = await getLedPositions(transport, info);
    const ledOf = new Map<string, number>();
    positions.forEach(([row, col], led) => {
      if (row !== 0xff) ledOf.set(keyId(row, col), led);
    });
    const colors: LayerColor[][] = [];
    const effects: LayerEffect[] = [];
    for (let layer = 0; layer < info.layerCount; layer++) {
      colors.push(await getLayerColors(transport, layer, info.ledCount));
      effects.push(await getLayerEffect(transport, layer));
    }
    return new LayerLighting(transport, info.layerCount, ledOf, colors, effects);
  }

  led(row: number, col: number): number | undefined {
    return this.ledOf.get(keyId(row, col));
  }

  /** Couleur de la touche sur la couche ; undefined = touche sans LED. */
  color(layer: number, row: number, col: number): LayerColor | undefined {
    const led = this.led(row, col);
    return led === undefined ? undefined : (this.colors[layer]?.[led] ?? null);
  }

  colorOfLed(layer: number, led: number): LayerColor {
    return this.colors[layer]?.[led] ?? null;
  }

  /** Change le modèle local sans écrire (aperçu pendant un glisser) ; renvoie les anciennes valeurs. */
  stage(layer: number, colors: ReadonlyMap<number, LayerColor>): Map<number, LayerColor> {
    const before = new Map<number, LayerColor>();
    const target = this.colors[layer];
    if (!target) return before;
    for (const [led, color] of colors) {
      before.set(led, target[led] ?? null);
      target[led] = color;
    }
    return before;
  }

  async write(layer: number, colors: ReadonlyMap<number, LayerColor>): Promise<void> {
    this.stage(layer, colors);
    await setLayerColors(this.transport, layer, colors);
  }

  effect(layer: number): LayerEffect | undefined {
    return this.effects[layer];
  }

  async setEffect(layer: number, effect: LayerEffect): Promise<void> {
    this.effects[layer] = { ...effect };
    await setLayerEffect(this.transport, layer, effect);
  }

  /** Valeurs par défaut du firmware, puis relecture de la couche. */
  async reset(layer: number): Promise<void> {
    await resetLayer(this.transport, layer);
    const info = await getLedStreamInfo(this.transport);
    this.colors[layer] = await getLayerColors(this.transport, layer, info.ledCount);
    this.effects[layer] = await getLayerEffect(this.transport, layer);
  }
}
