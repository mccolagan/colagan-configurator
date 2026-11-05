// Réglage RGB en direct : chaque changement part immédiatement, avec un débit limité (dernier état garanti).
import type { Transport } from '../protocol/packet';
import { saveRgb, setRgbMode, type RgbMode } from '../protocol/vialrgb';

export interface RgbControllerOptions {
  readonly maxBrightness: number;
  /** Intervalle minimal entre deux envois (ms) : 50 ms ≈ 20 envois/s. */
  readonly interval?: number;
  readonly onError?: (error: unknown) => void;
  /** Écriture d'un état ; défaut : VialRGB (non enregistré, voir save). */
  readonly write?: (mode: RgbMode) => Promise<void>;
  /** Chaque écriture est enregistrée par le clavier (effet d'une couche) : ni « Enregistrer » ni « Rétablir ». */
  readonly persistent?: boolean;
}

const sameMode = (a: RgbMode, b: RgbMode): boolean =>
  a.effect === b.effect &&
  a.speed === b.speed &&
  a.hue === b.hue &&
  a.saturation === b.saturation &&
  a.value === b.value;

export class RgbController {
  private current: RgbMode;
  private saved: RgbMode;
  private inFlight = false;
  private pending = false;
  private cooldown: ReturnType<typeof setTimeout> | undefined;
  private idleWaiters: (() => void)[] = [];
  private readonly interval: number;

  constructor(
    private readonly transport: Transport,
    initial: RgbMode,
    private readonly options: RgbControllerOptions,
  ) {
    this.current = { ...initial };
    // l'EEPROM n'est pas relisible : le mode lu à la connexion est supposé être celui enregistré
    this.saved = { ...initial };
    this.interval = options.interval ?? 50;
  }

  get mode(): Readonly<RgbMode> {
    return this.current;
  }

  get maxBrightness(): number {
    return this.options.maxBrightness;
  }

  get persistent(): boolean {
    return this.options.persistent ?? false;
  }

  /** Vrai si le clavier affiche autre chose que ce qui est enregistré dans son EEPROM. */
  get dirty(): boolean {
    return !sameMode(this.current, this.saved);
  }

  update(change: Partial<RgbMode>): void {
    const next = { ...this.current, ...change };
    next.value = Math.min(Math.max(0, next.value), this.options.maxBrightness);
    if (sameMode(next, this.current)) return;
    this.current = next;
    this.schedule();
  }

  /** Revient au dernier état enregistré (lu à la connexion ou sauvegardé depuis). */
  revert(): Promise<void> {
    this.update(this.saved);
    return this.flush();
  }

  async save(): Promise<void> {
    await this.flush();
    await saveRgb(this.transport);
    this.saved = { ...this.current };
  }

  /** Attend que le dernier état demandé soit parti vers le clavier. */
  flush(): Promise<void> {
    if (!this.inFlight && !this.pending) return Promise.resolve();
    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private hasPending(): boolean {
    return this.pending;
  }

  private schedule(): void {
    if (this.inFlight || this.cooldown !== undefined) {
      this.pending = true;
      return;
    }
    void this.send();
  }

  private async send(): Promise<void> {
    this.inFlight = true;
    this.pending = false;
    const mode = { ...this.current };
    try {
      await (this.options.write ?? ((m: RgbMode) => setRgbMode(this.transport, m)))(mode);
      if (this.persistent) this.saved = mode;
    } catch (error) {
      this.options.onError?.(error);
    } finally {
      this.inFlight = false;
      this.cooldown = setTimeout(() => {
        this.cooldown = undefined;
        if (this.pending) void this.send();
      }, this.interval);
      // relu via une méthode : `pending` a pu repasser à vrai pendant l'envoi (TS garde le rétrécissement)
      if (!this.hasPending()) {
        const waiters = this.idleWaiters;
        this.idleWaiters = [];
        waiters.forEach((resolve) => {
          resolve();
        });
      }
    }
  }
}
