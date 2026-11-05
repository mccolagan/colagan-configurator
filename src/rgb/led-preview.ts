// Aperçu en direct des LED : lit l'état réel du clavier (~20 images/s) et le traduit en couleurs par touche.
import { keyId } from '../ui/keyboard-view';
import type { Transport } from '../protocol/packet';
import {
  displayColor,
  getLedFrame,
  getLedPositions,
  getLedStreamInfo,
  LedStreamBusy,
  LedStreamUnsupported,
  type LedStreamInfo,
} from '../protocol/led-stream';

export type LedPaint =
  { readonly kind: 'on'; readonly css: string } | { readonly kind: 'off' } | { readonly kind: 'unknown' };

/** Couleur de chaque touche, clé = keyId(ligne, colonne). */
export type LedPaints = ReadonlyMap<string, LedPaint>;

export type PreviewState = 'idle' | 'running' | 'partial' | 'busy' | 'unsupported' | 'error';

export interface LedPreviewOptions {
  readonly intervalMs?: number;
  /** Relecture de l'info (luminosité, état du lien) : toutes les N images. */
  readonly infoEvery?: number;
  readonly retryMs?: number;
  readonly isHidden?: () => boolean;
  readonly onFrame: (paints: LedPaints) => void;
  readonly onState: (state: PreviewState, detail?: string) => void;
}

export class LedPreview {
  private info: LedStreamInfo | undefined;
  private positions: [number, number][] = [];
  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private frames = 0;
  private state: PreviewState = 'idle';
  private lastPaints: LedPaints = new Map();
  /** Incrémenté par stop() : une image en vol arrivée après l'arrêt est ignorée. */
  private generation = 0;

  constructor(
    private readonly transport: Transport,
    private readonly options: LedPreviewOptions,
  ) {}

  get current(): LedPaints {
    return this.lastPaints;
  }

  get active(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running || this.state === 'unsupported') return;
    this.running = true;
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    this.generation++;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.lastPaints = new Map();
    this.options.onFrame(this.lastPaints);
    if (this.state !== 'unsupported') this.setState('idle');
  }

  /** Lit une image et la publie ; renvoie le délai avant la suivante. */
  async poll(): Promise<number> {
    const interval = this.options.intervalMs ?? 50;
    const generation = this.generation;
    try {
      if (!this.info || this.frames % (this.options.infoEvery ?? 20) === 0) {
        this.info = await getLedStreamInfo(this.transport);
        if (!this.positions.length) this.positions = await getLedPositions(this.transport, this.info);
      }
      const info = this.info;
      const frame = await getLedFrame(this.transport, info);
      this.frames++;
      const paints = new Map<string, LedPaint>();
      this.positions.forEach(([row, col], led) => {
        if (row === 0xff) return;
        let paint: LedPaint;
        if (frame.unknown[led]) {
          paint = { kind: 'unknown' };
        } else {
          const [r, g, b] = displayColor(
            frame.colors[led * 3] ?? 0,
            frame.colors[led * 3 + 1] ?? 0,
            frame.colors[led * 3 + 2] ?? 0,
            info.value,
          );
          paint =
            r || g || b
              ? { kind: 'on', css: `rgb(${String(r)} ${String(g)} ${String(b)})` }
              : { kind: 'off' };
        }
        paints.set(keyId(row, col), paint);
      });
      if (generation !== this.generation) return interval;
      this.lastPaints = paints;
      this.options.onFrame(paints);
      this.setState(frame.unknown.some(Boolean) ? 'partial' : 'running');
      return interval;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (generation !== this.generation) return interval;
      if (error instanceof LedStreamUnsupported) {
        this.running = false;
        this.setState('unsupported', message);
        return interval;
      }
      this.setState(error instanceof LedStreamBusy ? 'busy' : 'error', message);
      return this.options.retryMs ?? 1000;
    }
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.loop();
    }, delay);
  }

  private async loop(): Promise<void> {
    if (!this.running) return;
    const hidden = this.options.isHidden?.() ?? document.visibilityState === 'hidden';
    if (hidden) {
      this.schedule(250);
      return;
    }
    const started = performance.now();
    const generation = this.generation;
    const delay = await this.poll();
    // arrêté (puis peut-être relancé) pendant la lecture : la nouvelle boucle a déjà sa propre minuterie
    if (generation === this.generation) this.schedule(Math.max(0, delay - (performance.now() - started)));
  }

  private setState(state: PreviewState, detail?: string): void {
    if (state === this.state && state !== 'error') return;
    this.state = state;
    this.options.onState(state, detail);
  }
}
