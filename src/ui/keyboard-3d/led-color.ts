// Traduction de l'aperçu LED (LedPaint) en couleurs de la vue 3D : LED sous la touche et légende rétroéclairée.
import type { LedPaint } from '../../rgb/led-preview';

/** Couleur sRGB, composantes entre 0 et 1. */
export type Rgb = readonly [number, number, number];

const OFF_LEGEND = 0.62;
const EFFECT_GLOW: Rgb = [0.16, 0.16, 0.18];

/** Lit « rgb(r g b) », « rgb(r, g, b) » ou « #rrggbb » (0-255) ; undefined si illisible. */
export function parseCssColor(css: string): Rgb | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (hex?.[1]) {
    const v = parseInt(hex[1], 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }
  const parts = /^rgba?\(([^)]*)\)$/i
    .exec(css.trim())?.[1]
    ?.split(/[\s,/]+/)
    .filter(Boolean);
  if (parts?.length !== 3 && parts?.length !== 4) return undefined;
  const [r, g, b] = parts.slice(0, 3).map(Number);
  if (r === undefined || g === undefined || b === undefined || [r, g, b].some((n) => !Number.isFinite(n))) {
    return undefined;
  }
  const clamp = (n: number): number => Math.min(1, Math.max(0, n / 255));
  return [clamp(r), clamp(g), clamp(b)];
}

/** Couleur émise par la LED d'une touche (noir = éteinte ou inconnue). */
export function ledColor(paint: LedPaint | undefined): Rgb {
  if (!paint) return [0, 0, 0];
  if (paint.kind === 'on') return parseCssColor(paint.css) ?? [0, 0, 0];
  if (paint.kind === 'effect') return EFFECT_GLOW;
  return [0, 0, 0];
}

/**
 * Couleur de la légende : teinte de la LED éclaircie (lisible sur une keycap sombre), gris si la LED est éteinte.
 * La teinte est normalisée pour rester reconnaissable même à faible luminosité.
 */
export function legendColor(led: Rgb): Rgb {
  const max = Math.max(...led);
  if (max < 0.02) return [OFF_LEGEND, OFF_LEGEND, OFF_LEGEND];
  const tint = 0.6;
  const brightness = OFF_LEGEND + (0.98 - OFF_LEGEND) * Math.min(1, max * 3);
  const tinted = (c: number): number => (1 - tint + (tint * c) / max) * brightness;
  return [tinted(led[0]), tinted(led[1]), tinted(led[2])];
}
