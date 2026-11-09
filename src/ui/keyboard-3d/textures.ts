// Textures dessinées sur canvas : halos des LED, sérigraphie du PCB, dessus des Raspberry Pi Pico.
import * as THREE from 'three';
import { polygonBounds, type Point } from './geometry';
import { parseCssColor } from './led-color';

export const SCENE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
export const SCENE_MONO = '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace';
/** Empreinte d'un Pico (unités de touche). */
export const PICO_SIZE = { w: 1.1, d: 2.68 } as const;

const SILK_PX = 112;
const SILK_INK = 'rgba(240,236,244,.82)';
const PAD = '#C9A55A';

function texture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function radialTexture(stops: readonly (readonly [number, number])[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(255,255,255,${String(alpha)})`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
  }
  return texture(canvas);
}

/** Couleur d'une piste : vernis éclairci, semi-transparent. */
function traceColor(pcb: string): string {
  const rgb = parseCssColor(pcb) ?? [0.3, 0.3, 0.32];
  const [r, g, b] = rgb.map((c) => String(Math.round(Math.min(1, c * 1.8) * 255)));
  return `rgba(${r ?? '0'},${g ?? '0'},${b ?? '0'},.45)`;
}

export interface SilkSpec {
  readonly outline: readonly Point[];
  readonly color: string;
  readonly keys: readonly {
    readonly cx: number;
    readonly cy: number;
    readonly angle: number;
    readonly ch: number;
  }[];
  readonly wires: readonly (readonly Point[])[];
  readonly boards: readonly Point[];
  readonly pads: readonly Point[];
  readonly holes: readonly Point[];
  readonly texts: readonly { readonly x: number; readonly y: number; readonly lines: readonly string[] }[];
}

/** Sérigraphie d'une carte, plaquée sur le dessus de l'extrusion (UV = coordonnées de la forme). */
export function silkTexture(spec: SilkSpec): THREE.CanvasTexture {
  const b = polygonBounds(spec.outline);
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bw * SILK_PX);
  canvas.height = Math.ceil(bh * SILK_PX);
  const X = (x: number): number => (x - b.minX) * SILK_PX;
  const Y = (y: number): number => (y - b.minY) * SILK_PX;
  const P = (n: number): number => n * SILK_PX;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = spec.color;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = traceColor(spec.color);
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const wire of spec.wires) {
      g.beginPath();
      wire.forEach(([x, y], i) => {
        if (i === 0) g.moveTo(X(x), Y(y));
        else g.lineTo(X(x), Y(y));
      });
      g.stroke();
    }
    for (const key of spec.keys) {
      g.save();
      g.translate(X(key.cx), Y(key.cy));
      g.rotate((key.angle * Math.PI) / 180);
      const s = P(0.78);
      g.strokeStyle = SILK_INK;
      g.lineWidth = 1.6;
      g.beginPath();
      g.roundRect(-s / 2, -s / 2, s, s, 8);
      g.stroke();
      g.fillStyle = PAD;
      g.beginPath();
      g.roundRect(P(-0.3), P(0.16), P(0.17), P(0.1), 3);
      g.roundRect(P(0.12), P(0.26), P(0.17), P(0.1), 3);
      g.fill();
      g.fillStyle = '#16091c';
      g.fillRect(P(-0.1), P(-0.36), P(0.2), P(0.14));
      g.fillStyle = SILK_INK;
      g.font = `500 ${String(Math.round(P(0.1)))}px ${SCENE_MONO}`;
      g.textBaseline = 'alphabetic';
      g.fillText(`CH${String(key.ch)}`, P(-0.37), P(0.45));
      g.restore();
    }
    for (const [x, y] of spec.boards) {
      const px = X(x);
      const py = Y(y);
      g.strokeStyle = SILK_INK;
      g.lineWidth = 1.6;
      g.strokeRect(px - P(PICO_SIZE.w) / 2, py - P(PICO_SIZE.d) / 2, P(PICO_SIZE.w), P(PICO_SIZE.d));
      for (let n = 0; n < 20; n++) {
        const yy = py - P(1.265) + n * P(0.1333);
        for (const side of [-1, 1]) {
          g.fillStyle = PAD;
          g.beginPath();
          g.arc(px + side * P(0.48), yy, P(0.045), 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#16091c';
          g.beginPath();
          g.arc(px + side * P(0.48), yy, P(0.022), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.fillStyle = PAD;
    for (const [x, y] of spec.pads) {
      for (let n = 0; n < 8; n++) g.fillRect(X(x) - P(0.16), Y(y) - P(0.2) + n * P(0.05), P(0.2), P(0.025));
    }
    for (const [x, y] of spec.holes) {
      g.fillStyle = PAD;
      g.beginPath();
      g.arc(X(x), Y(y), P(0.15), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0d0710';
      g.beginPath();
      g.arc(X(x), Y(y), P(0.085), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = SILK_INK;
    g.font = `600 ${String(Math.round(P(0.1)))}px ${SCENE_FONT}`;
    g.textAlign = 'center';
    for (const text of spec.texts) {
      text.lines.forEach((line, i) => {
        g.fillText(line, X(text.x), Y(text.y + i * 0.14));
      });
    }
  }
  const tex = texture(canvas);
  tex.anisotropy = 8;
  tex.repeat.set(1 / bw, 1 / bh);
  tex.offset.set(-b.minX / bw, b.maxY / bh);
  return tex;
}

/** Dessus d'un Raspberry Pi Pico : pastilles, RP2040, flash, bouton BOOTSEL et, pour le Pico W, le module radio. */
export function boardTexture(label: string, wireless: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 536;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#1F6B40';
    g.fillRect(0, 0, 220, 536);
    g.fillStyle = PAD;
    for (let n = 0; n < 20; n++) {
      const y = 18 + n * 26.6;
      g.beginPath();
      g.arc(4, y, 9, 0, Math.PI * 2);
      g.arc(216, y, 9, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#17141a';
    g.fillRect(70, 230, 80, 80);
    g.fillStyle = '#d8d2c8';
    g.font = `600 13px ${SCENE_MONO}`;
    g.textAlign = 'center';
    g.fillText('RP2040', 110, 275);
    g.fillStyle = '#121014';
    g.fillRect(84, 130, 52, 40);
    g.fillStyle = '#f2efe9';
    g.beginPath();
    g.roundRect(60, 70, 30, 30, 4);
    g.fill();
    if (wireless) {
      g.fillStyle = '#B9BCC2';
      g.fillRect(40, 400, 140, 110);
    }
    g.fillStyle = '#f2efe9';
    g.font = `600 18px ${SCENE_FONT}`;
    g.fillText(label, 110, wireless ? 380 : 440);
  }
  return texture(canvas);
}
