// Vignettes animées des effets VialRGB (approximation visuelle, calculée dans le navigateur).
import type { KeyGeometry } from '../../keyboard/kle';

export interface PreviewKey {
  /** Centre normalisé (0-1) dans l'encombrement du clavier. */
  readonly nx: number;
  readonly ny: number;
  readonly w: number;
  readonly mod: boolean;
}

export interface EffectParams {
  readonly hue: number;
  readonly saturation: number;
  readonly speed: number;
}

type Rgb = [number, number, number];

export function previewKeys(keys: readonly KeyGeometry[]): PreviewKey[] {
  const centers = keys.map((k) => {
    const rad = (k.r * Math.PI) / 180;
    const dx = k.x + k.w / 2 - k.rx;
    const dy = k.y + k.h / 2 - k.ry;
    return {
      cx: k.rx + dx * Math.cos(rad) - dy * Math.sin(rad),
      cy: k.ry + dx * Math.sin(rad) + dy * Math.cos(rad),
      w: k.w,
      mod: k.w > 1 || k.r !== 0,
    };
  });
  const xs = centers.map((c) => c.cx);
  const ys = centers.map((c) => c.cy);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  return centers.map((c) => ({ nx: (c.cx - minX) / spanX, ny: (c.cy - minY) / spanY, w: c.w, mod: c.mod }));
}

export function hsv(h: number, s: number, v: number): Rgb {
  const hh = ((h % 1) + 1) % 1;
  const i = Math.floor(hh * 6);
  const f = hh * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const table: Rgb[] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  return table[i % 6] ?? [v, v, v];
}

const frac = (x: number): number => x - Math.floor(x);

interface Context {
  readonly rain: Float32Array;
  readonly hits: readonly { x: number; y: number; t: number }[];
}

/** Couleur (0-1) d'une touche pour l'effet `name` (nom VialRGB) à l'instant t (s). */
export function effectColor(
  name: string,
  k: PreviewKey,
  i: number,
  t: number,
  p: EffectParams,
  ctx: Context,
): Rgb {
  const h = p.hue / 255;
  const s = p.saturation / 255;
  const sp = 0.15 + (p.speed / 255) * 1.6;
  const dist = Math.hypot(k.nx - 0.5, (k.ny - 0.5) * 0.4);
  const angle = Math.atan2(k.ny - 0.5, (k.nx - 0.5) * 2.9) / (Math.PI * 2);
  const band = (f: number, kind: string): Rgb =>
    kind.endsWith('SAT') ? hsv(h, s * (1 - f), 1) : hsv(h, s, 0.15 + 0.85 * f);
  const near = (x: number): number => Math.max(0, 1 - x * 5);

  if (name === 'OFF') return [0, 0, 0];
  if (name === 'DIRECT') return hsv(k.nx * 0.8, 0.55, 0.55);
  if (name === 'SOLID_COLOR') return hsv(h, s, 1);
  if (name === 'ALPHAS_MODS') return hsv(k.mod ? h + 0.12 : h, s, 1);
  if (name === 'GRADIENT_UP_DOWN') return hsv(h + k.ny * 0.45, s, 1);
  if (name === 'GRADIENT_LEFT_RIGHT') return hsv(h + k.nx * 0.45, s, 1);
  if (name === 'BREATHING') return hsv(h, s, 0.1 + 0.9 * (0.5 - 0.5 * Math.cos(t * sp * 2.2)));
  if (name.startsWith('BAND_PINWHEEL'))
    return band(near(Math.abs(frac(angle + t * sp * 0.3) - 0.5) - 0.3), name);
  if (name.startsWith('BAND_SPIRAL'))
    return band(near(Math.abs(frac(angle + dist * 1.5 + t * sp * 0.3) - 0.5) - 0.3), name);
  if (name.startsWith('BAND_')) return band(near(Math.abs(k.nx - frac(t * sp * 0.25) * 1.4 + 0.2)), name);
  if (name === 'CYCLE_ALL') return hsv(h + t * sp * 0.3, s, 1);
  if (name === 'CYCLE_LEFT_RIGHT') return hsv(h + k.nx - t * sp * 0.35, s, 1);
  if (name === 'CYCLE_UP_DOWN') return hsv(h + k.ny - t * sp * 0.35, s, 1);
  if (name === 'RAINBOW_MOVING_CHEVRON')
    return hsv(h + Math.abs(k.ny - 0.5) * 0.6 + k.nx * 0.5 - t * sp * 0.35, s, 1);
  if (name === 'CYCLE_OUT_IN') return hsv(h + dist * 1.8 + t * sp * 0.4, s, 1);
  if (name === 'CYCLE_OUT_IN_DUAL')
    return hsv(h + Math.abs(Math.abs(k.nx - 0.5) - 0.25) * 2.4 + t * sp * 0.4, s, 1);
  if (name === 'CYCLE_PINWHEEL') return hsv(h + angle + t * sp * 0.3, s, 1);
  if (name === 'CYCLE_SPIRAL') return hsv(h + angle + dist * 1.5 + t * sp * 0.3, s, 1);
  if (name === 'DUAL_BEACON' || name === 'RAINBOW_BEACON') {
    const a = t * sp;
    const amount = name === 'DUAL_BEACON' ? 0.25 : 0.6;
    return hsv(h + ((k.nx - 0.5) * Math.cos(a) + (k.ny - 0.5) * Math.sin(a)) * amount * 2, s, 1);
  }
  if (name === 'RAINBOW_PINWHEELS') {
    const side = k.nx < 0.5 ? 0.25 : 0.75;
    return hsv(h + Math.atan2(k.ny - 0.5, (k.nx - side) * 2.9) / Math.PI + t * sp * 0.3, s, 1);
  }
  if (name === 'HUE_BREATHING') return hsv(h + 0.08 * Math.sin(t * sp * 2), s, 1);
  if (name === 'HUE_PENDULUM') return hsv(h + 0.1 * Math.sin(t * sp * 2 + k.nx * 3), s, 1);
  if (name === 'HUE_WAVE') return hsv(h + 0.15 * Math.sin(k.nx * 6 - t * sp * 3), s, 1);
  if (name === 'TYPING_HEATMAP') {
    const q = Math.max(0, 1 - Math.hypot(k.nx - 0.75, k.ny - 0.35) * 2.6) + (k.mod ? 0.25 : 0);
    return q < 0.05 ? [0.02, 0.05, 0.16] : hsv(0.66 * (1 - Math.min(1, q)), 1, 0.35 + 0.65 * Math.min(1, q));
  }
  if (/RAIN|PIXEL|STAR/.test(name)) {
    const v = ctx.rain[i] ?? 0;
    return name === 'DIGITAL_RAIN'
      ? [0, frac(v * 7 + t * sp) > 0.7 ? 1 : 0.12, 0]
      : hsv(h + v, s, frac(v * 13) > 0.25 ? 1 : 0.2);
  }
  if (/REACTIVE|SPLASH/.test(name)) {
    let v = name.startsWith('SOLID_REACTIVE') ? 0.1 : 0.05;
    let hh = h;
    for (const hit of ctx.hits) {
      const age = t - hit.t;
      if (age < 0 || age > 1.8) continue;
      const d = Math.hypot((k.nx - hit.x) * 3, (k.ny - hit.y) * 1.1);
      const w = Math.exp(-((d - age * (1.2 + sp)) ** 2) / 0.05) * (1 - age / 1.8);
      if (w > 0.02) {
        v += w;
        hh = h + d * 0.15;
      }
    }
    return hsv(name.startsWith('SOLID') ? h : hh, s, Math.min(1, v));
  }
  return hsv(h, s, 1);
}

/** Vignettes animées tant qu'elles sont visibles (une seule boucle, 30 images/s). */
export class EffectPreviews {
  private readonly tiles: { canvas: HTMLCanvasElement; name: string }[] = [];
  private readonly rain: Float32Array;
  private frame = 0;
  private last = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly keys: readonly PreviewKey[],
    private params: () => EffectParams,
  ) {
    this.rain = Float32Array.from(keys, () => Math.random());
  }

  setParams(params: () => EffectParams): void {
    this.params = params;
  }

  clear(): void {
    this.tiles.length = 0;
  }

  add(canvas: HTMLCanvasElement, name: string): void {
    this.tiles.push({ canvas, name });
    this.draw(canvas, name, 1.2);
    this.wake();
  }

  wake(): void {
    if (!this.frame)
      this.frame = requestAnimationFrame((now) => {
        this.tick(now);
      });
  }

  private tick(now: number): void {
    this.frame = 0;
    const visible = this.tiles.filter((tile) => tile.canvas.isConnected && tile.canvas.offsetParent !== null);
    if (!visible.length || document.hidden) return;
    if (now - this.last > 33) {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const params = this.params();
      const sp = 0.25 + params.speed / 255;
      for (let i = 0; i < this.rain.length; i++) if (Math.random() < dt * sp) this.rain[i] = Math.random();
      for (const tile of visible) this.draw(tile.canvas, tile.name, now / 1000);
    }
    if (!this.reduced) this.wake();
  }

  private draw(canvas: HTMLCanvasElement, name: string, t: number): void {
    const g = canvas.getContext('2d');
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    const params = this.params();
    const period = t % 1.8;
    const ctx: Context = {
      rain: this.rain,
      hits: [
        { x: 0.3, y: 0.35, t: t - period },
        { x: 0.75, y: 0.45, t: t - ((t + 0.9) % 1.8) },
      ],
    };
    g.fillStyle = '#111113';
    g.fillRect(0, 0, W, H);
    const size = Math.min((W - 20) / 19, (H - 20) / 6.4) * 0.92;
    this.keys.forEach((k, i) => {
      const [r, gg, b] = effectColor(name, k, i, t, params, ctx);
      g.fillStyle = `rgb(${String(Math.round(r * 255))} ${String(Math.round(gg * 255))} ${String(Math.round(b * 255))})`;
      const x = 10 + k.nx * (W - 20 - size * k.w) + (size * k.w) / 2;
      const y = 10 + k.ny * (H - 20 - size) + size / 2;
      g.beginPath();
      g.roundRect(x - (size * k.w) / 2, y - size / 2, size * k.w * 0.92, size * 0.92, 2);
      g.fill();
    });
  }
}
