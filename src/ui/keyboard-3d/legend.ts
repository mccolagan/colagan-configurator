// Légende d'une keycap dessinée sur canvas (texture) : même disposition que le dessin SVG,
// caractère principal au centre, Maj en haut à gauche, AltGr en bas à droite.
import type { KeyLabel } from '../../keycodes/labels';
import type { KeyKind } from '../keyboard-view';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
/** Résolution de la texture : 192 px par unité de touche. */
export const LEGEND_PX = 192;

function fit(
  g: CanvasRenderingContext2D,
  lines: readonly string[],
  weight: number,
  max: number,
  width: number,
): number {
  let size = max;
  const measure = (): number => Math.max(...lines.map((line) => g.measureText(line).width));
  g.font = `${String(weight)} ${String(size)}px ${FONT}`;
  while (size > 16 && measure() > width) {
    size -= 2;
    g.font = `${String(weight)} ${String(size)}px ${FONT}`;
  }
  return size;
}

/** Signature d'une légende : redessiner seulement si elle change. */
export const legendKey = (label: KeyLabel, kind: KeyKind): string =>
  [kind, label.main, label.shift ?? '', label.altgr ?? ''].join('\u0001');

export function drawLegend(canvas: HTMLCanvasElement, label: KeyLabel, kind: KeyKind): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width;
  const H = canvas.height;
  g.clearRect(0, 0, W, H);
  if (kind === 'none') return;
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.globalAlpha = kind === 'transparent' ? 0.4 : 1;
  const lines = label.main.split('\n').filter((line) => line !== '');
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const max = longest <= 1 ? 84 : longest <= 2 ? 70 : longest <= 4 ? 54 : 44;
  const size = fit(g, lines, 600, Math.min(max, 120 / Math.max(1, lines.length)), W * 0.78);
  const lineHeight = size * 1.08;
  const top = H / 2 - ((lines.length - 1) * lineHeight) / 2 + (label.shift || label.altgr ? H * 0.04 : 0);
  lines.forEach((line, i) => {
    g.fillText(line, W / 2, top + i * lineHeight);
  });
  g.globalAlpha *= 0.72;
  g.font = `500 34px ${FONT}`;
  if (label.shift) {
    g.textAlign = 'left';
    g.fillText(label.shift, W * 0.12, H * 0.2);
  }
  if (label.altgr) {
    g.textAlign = 'right';
    g.fillText(label.altgr, W * 0.88, H * 0.8);
  }
}
