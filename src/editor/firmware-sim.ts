// Onglet « Essai » : simulation du comportement des couches sur la keymap réelle (rien n'est envoyé au clavier).
import { layerTarget, parentLayer, type KeymapView } from './layer-access';

export type SimEvent =
  | { readonly kind: 'key'; readonly code: number }
  | { readonly kind: 'layer'; readonly layer: number; readonly via: string }
  | { readonly kind: 'boot' }
  | { readonly kind: 'none' };

export interface TripleTap {
  readonly code: number;
  readonly layer: number;
}

const TRIPLE_TAP_MS = 500;

export class FirmwareSim {
  /** Couche « de base » (TO / DF) et couches tenues (MO, LT…) par la touche qui les tient. */
  private base = 0;
  private readonly held = new Map<string, number>();
  private taps: number[] = [];

  constructor(
    private readonly view: KeymapView,
    private readonly tripleTap?: TripleTap,
  ) {}

  /** Couche du dessus : la dernière tenue, sinon la couche de base. */
  get layer(): number {
    let top = this.base;
    for (const layer of this.held.values()) top = Math.max(top, layer);
    return top;
  }

  get activeLayers(): number[] {
    return [...new Set([0, this.base, ...this.held.values()])].sort((a, b) => a - b);
  }

  reset(base = 0): void {
    this.base = base;
    this.held.clear();
    this.taps = [];
  }

  private resolve(row: number, col: number): number {
    const active = new Set(this.activeLayers);
    for (let layer = this.layer; layer >= 0; layer--) {
      if (!active.has(layer)) continue;
      const code = this.view.getKey(layer, row, col);
      if (code !== 1) return code;
    }
    return 0;
  }

  press(row: number, col: number, now = performance.now()): SimEvent {
    const code = this.resolve(row, col);
    const name = this.view.serialize(code);
    const triple = this.tripleTap;
    if (triple?.code === code) {
      if (this.layer === triple.layer) {
        this.base = parentLayer(this.view, triple.layer) ?? 0;
        this.taps = [];
        return { kind: 'layer', layer: this.base, via: name };
      }
      this.taps = [...this.taps.filter((t) => now - t < TRIPLE_TAP_MS), now];
      if (this.taps.length < 3) return { kind: 'none' };
      this.taps = [];
      this.base = triple.layer;
      return { kind: 'layer', layer: this.base, via: name };
    }
    const target = layerTarget(name);
    if (target && target.layer < this.view.layers) {
      if (target.kind === 'TO' || target.kind === 'DF') {
        this.base = target.layer;
        this.held.clear();
      } else if (target.kind === 'TG') {
        this.base = this.base === target.layer ? 0 : target.layer;
      } else {
        this.held.set(`${String(row)},${String(col)}`, target.layer);
      }
      return { kind: 'layer', layer: this.layer, via: name };
    }
    if (name === 'QK_BOOT') return { kind: 'boot' };
    if (code === 0) return { kind: 'none' };
    return { kind: 'key', code };
  }

  /** Relâche : une couche tenue par cette touche se referme. */
  release(row: number, col: number): boolean {
    return this.held.delete(`${String(row)},${String(col)}`);
  }
}
