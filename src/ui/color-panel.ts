// Mode « Couleurs » : pinceau (couleur, éteinte ou transparente) et effet RGB de la couche affichée.
import { t, type MessageKey } from '../i18n';
import type { LayerColor } from '../protocol/led-stream';
import type { LayerLighting } from '../rgb/layer-lighting';
import { RgbController } from '../rgb/rgb-controller';
import { renderRgbPanel } from './rgb-panel';

/** Palette de départ : celle des couleurs par couche du firmware (keymap.c). */
const SWATCHES: readonly (readonly [string, readonly [number, number, number]])[] = [
  ['RED', [255, 0, 0]],
  ['ORG', [255, 100, 0]],
  ['YEL', [255, 255, 0]],
  ['GRN', [0, 255, 0]],
  ['BLU', [0, 0, 255]],
  ['PUR', [255, 0, 255]],
  ['WHT', [255, 255, 255]],
  ['GRY', [50, 50, 50]],
];

export const OFF_COLOR: LayerColor = [0, 0, 0];

export const cssColor = (c: readonly [number, number, number]): string =>
  `rgb(${String(c[0])} ${String(c[1])} ${String(c[2])})`;

const hex = (c: readonly [number, number, number]): string =>
  `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const fromHex = (value: string): [number, number, number] => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const sameColor = (a: LayerColor, b: LayerColor): boolean =>
  a === b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);

export interface ColorPanelOptions {
  readonly lighting: LayerLighting | undefined;
  readonly layer: number;
  readonly layerName: string;
  readonly brush: LayerColor;
  readonly onBrush: (brush: LayerColor) => void;
  /** Panneau de l'effet global (VialRGB), affiché sur la couche 0 ou si le firmware n'a pas les couches. */
  readonly globalRgb: () => HTMLElement;
  readonly globalMode: () => {
    effect: number;
    speed: number;
    hue: number;
    saturation: number;
    value: number;
  };
  readonly supportedEffects: readonly number[];
  readonly maxBrightness: number;
  readonly onReset: () => void;
  readonly onError: (message: string) => void;
}

export function renderColorPanel(options: ColorPanelOptions): HTMLElement {
  const { lighting, layer } = options;
  const panel = document.createElement('section');
  panel.className = 'color-panel';
  panel.setAttribute('aria-label', t('colors.label'));

  if (!lighting) {
    const note = document.createElement('p');
    note.className = 'status';
    note.dataset.level = 'info';
    note.textContent = t('colors.unsupported');
    panel.append(note, effectHeading(t('effect.global'), t('effect.globalNote')), options.globalRgb());
    return panel;
  }

  // --- pinceau
  const brushRow = document.createElement('div');
  brushRow.className = 'color-panel__brush';
  brushRow.setAttribute('role', 'radiogroup');
  brushRow.setAttribute('aria-label', t('colors.brush'));
  const choices: { color: LayerColor; button: HTMLButtonElement }[] = [];
  const choice = (color: LayerColor, label: string, className: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `swatch ${className}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('role', 'radio');
    if (color && className === 'swatch--color') button.style.background = cssColor(color);
    button.addEventListener('click', () => {
      options.onBrush(color);
      sync(color);
    });
    choices.push({ color, button });
    return button;
  };
  for (const [name, rgb] of SWATCHES)
    brushRow.append(choice(rgb, t(`colors.swatch.${name}` as MessageKey), 'swatch--color'));
  brushRow.append(
    choice(OFF_COLOR, t('colors.off'), 'swatch--off'),
    choice(null, t('colors.transparent'), 'swatch--transparent'),
  );
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.id = 'brush-custom';
  custom.title = t('colors.custom');
  custom.setAttribute('aria-label', t('colors.custom'));
  custom.addEventListener('input', () => {
    const color = fromHex(custom.value);
    options.onBrush(color);
    sync(color);
  });
  brushRow.append(custom);

  const current = document.createElement('p');
  current.className = 'color-panel__current';
  current.id = 'brush-current';

  function sync(brush: LayerColor): void {
    let matched = false;
    for (const c of choices) {
      const on: boolean = sameColor(c.color, brush) && !matched;
      matched ||= on;
      c.button.setAttribute('aria-checked', String(on));
    }
    if (brush) custom.value = hex(brush);
    current.textContent = t('colors.current', {
      color: brush === null ? t('colors.transparent') : hex(brush).toUpperCase(),
    });
  }
  sync(options.brush);

  const hint = document.createElement('p');
  hint.className = 'color-panel__hint';
  hint.textContent = t('colors.hint');

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'secondary';
  reset.id = 'colors-reset';
  reset.textContent = t('colors.reset');
  reset.addEventListener('click', options.onReset);

  panel.append(brushRow, current, hint, reset);

  // --- effet de la couche
  if (layer === 0) {
    panel.append(effectHeading(t('effect.global'), t('effect.globalNote')), options.globalRgb());
    return panel;
  }
  const effectBox = document.createElement('div');
  effectBox.className = 'color-panel__effect';
  const own = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = 'effect-own';
  own.append(toggle, ` ${t('effect.own', { layer: options.layerName })}`);
  const body = document.createElement('div');
  const renderEffect = (): void => {
    const effect = lighting.effect(layer);
    toggle.checked = Boolean(effect?.override);
    if (!effect?.override) {
      const note = document.createElement('p');
      note.className = 'rgb__note';
      note.textContent = t('effect.inherit');
      body.replaceChildren(note);
      return;
    }
    const controller = new RgbController({ request: () => Promise.reject(new Error('inutilisé')) }, effect, {
      maxBrightness: options.maxBrightness,
      persistent: true,
      write: (mode) => lighting.setEffect(layer, { ...mode, override: true }),
      onError: (error) => {
        options.onError(error instanceof Error ? error.message : String(error));
      },
    });
    body.replaceChildren(
      renderRgbPanel({
        controller,
        supportedEffects: options.supportedEffects,
        ledmapLayers: [],
        onError: options.onError,
      }),
    );
  };
  toggle.addEventListener('change', () => {
    const effect = toggle.checked
      ? { ...options.globalMode(), override: true }
      : { ...(lighting.effect(layer) ?? options.globalMode()), override: false };
    lighting
      .setEffect(layer, effect)
      .then(renderEffect)
      .catch((error: unknown) => {
        options.onError(error instanceof Error ? error.message : String(error));
      });
  });
  renderEffect();
  effectBox.append(effectHeading(t('effect.layer', { layer: options.layerName }), ''), own, body);
  panel.append(effectBox);
  return panel;
}

function effectHeading(title: string, note: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'color-panel__heading';
  const h = document.createElement('h3');
  h.textContent = title;
  box.append(h);
  if (note) {
    const p = document.createElement('p');
    p.className = 'rgb__note';
    p.textContent = note;
    box.append(p);
  }
  return box;
}
