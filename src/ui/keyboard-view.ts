// Dessin SVG du clavier à partir de la géométrie KLE (pouces tournés, touches 1,5U).
import { layoutBounds, type KeyGeometry } from '../keyboard/kle';
import type { KeyLabel } from '../keycodes/labels';

const UNIT = 56;
const GAP = 4;
const SVG_NS = 'http://www.w3.org/2000/svg';

export type KeyKind = 'normal' | 'transparent' | 'none';

export interface KeyView {
  readonly geometry: KeyGeometry;
  readonly label: KeyLabel;
  readonly title: string;
  readonly kind: KeyKind;
}

export const keyId = (row: number, col: number): string => `${String(row)},${String(col)}`;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function addText(
  group: SVGGElement,
  lines: readonly string[],
  x: number,
  y: number,
  fontSize: number,
  className?: string,
): void {
  const text = svg('text', {
    x,
    y: y - ((lines.length - 1) * fontSize * 1.1) / 2,
    'font-size': fontSize.toFixed(1),
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    ...(className ? { class: className } : {}),
  });
  lines.forEach((line, i) => {
    const tspan = svg('tspan', { x, dy: i === 0 ? 0 : (fontSize * 1.1).toFixed(1) });
    tspan.textContent = line;
    text.append(tspan);
  });
  group.append(text);
}

function addLabel(group: SVGGElement, label: KeyLabel, k: KeyGeometry): void {
  const lines = label.main.split('\n').filter((line) => line !== '');
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const width = k.w * UNIT - GAP * 2;
  const fontSize = Math.max(8, Math.min(15, (width / longest) * 1.6, 34 / Math.max(1, lines.length)));
  const cx = (k.x + k.w / 2) * UNIT;
  const cy = (k.y + k.h / 2) * UNIT;
  addText(group, lines, cx, cy, fontSize);
  // Shift en haut à gauche, AltGr en bas à droite, comme sur les touches imprimées
  const corner = UNIT * 0.24;
  if (label.shift) addText(group, [label.shift], k.x * UNIT + corner, k.y * UNIT + corner, 13, 'key__shift');
  if (label.altgr) {
    addText(group, [label.altgr], (k.x + k.w) * UNIT - corner, (k.y + k.h) * UNIT - corner, 13, 'key__altgr');
  }
}

export interface KeyboardViewOptions {
  readonly keys: readonly KeyView[];
  readonly selected?: string;
  /** Absent : dessin en lecture seule (aperçu), touches non sélectionnables. */
  readonly onSelect?: (row: number, col: number, event: MouseEvent | KeyboardEvent) => void;
}

export function renderKeyboard({ keys, selected, onSelect }: KeyboardViewOptions): SVGSVGElement {
  const b = layoutBounds(keys.map((k) => k.geometry));
  const pad = 0.1;
  const root = svg('svg', {
    class: 'keyboard',
    viewBox: [
      (b.minX - pad) * UNIT,
      (b.minY - pad) * UNIT,
      (b.maxX - b.minX + pad * 2) * UNIT,
      (b.maxY - b.minY + pad * 2) * UNIT,
    ].join(' '),
    role: 'group',
  });

  for (const view of keys) {
    const k = view.geometry;
    const id = keyId(k.row, k.col);
    const group = svg('g', {
      class: `key key--${view.kind}${id === selected ? ' key--selected' : ''}${onSelect ? '' : ' key--static'}`,
      transform: `rotate(${String(k.r)} ${String(k.rx * UNIT)} ${String(k.ry * UNIT)})`,
      ...(onSelect
        ? { tabindex: 0, role: 'button', 'aria-pressed': id === selected ? 'true' : 'false' }
        : {}),
      'aria-label': `${view.title} (${id})`,
      // dessin d'aperçu : autre attribut, pour que [data-key] ne désigne que les touches éditables
      [onSelect ? 'data-key' : 'data-preview-key']: id,
    });
    const title = svg('title', {});
    title.textContent = `${view.title}\n[${id}]`;
    group.append(
      title,
      svg('rect', {
        x: k.x * UNIT + GAP / 2,
        y: k.y * UNIT + GAP / 2,
        width: k.w * UNIT - GAP,
        height: k.h * UNIT - GAP,
        rx: 7,
      }),
      // calque de l'aperçu LED (voir paintLeds), sous l'étiquette
      svg('rect', {
        class: 'key__led',
        x: k.x * UNIT + GAP / 2 + 3,
        y: k.y * UNIT + GAP / 2 + 3,
        width: k.w * UNIT - GAP - 6,
        height: k.h * UNIT - GAP - 6,
        rx: 5,
      }),
    );
    addLabel(group, view.label, k);
    if (onSelect) {
      group.addEventListener('click', (event) => {
        onSelect(k.row, k.col, event);
      });
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(k.row, k.col, event);
        }
      });
    }
    root.append(group);
  }
  return root;
}

/** Couleur d'aperçu par touche (clé keyId) ; une touche absente de la table perd son aperçu. */
export function paintLeds(
  root: Element,
  paints: ReadonlyMap<string, { readonly kind: string; readonly css?: string }>,
): void {
  for (const led of root.querySelectorAll<SVGRectElement>('.key__led')) {
    const group = led.parentElement;
    const id = group?.dataset.key ?? group?.dataset.previewKey ?? '';
    const paint = paints.get(id);
    led.dataset.led = paint?.kind ?? '';
    led.style.fill = paint?.kind === 'on' && paint.css ? paint.css : '';
  }
}
