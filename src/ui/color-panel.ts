// Onglet « Lumière » : pinceau (couleur, éteinte ou transparente) et effet RGB de la couche affichée.
import { t, type MessageKey } from '../i18n';
import type { LayerColor } from '../protocol/led-stream';
import type { LayerLighting } from '../rgb/layer-lighting';
import { RgbController } from '../rgb/rgb-controller';
import { renderRgbPanel } from './rgb-panel';
import { errorMessage, h } from './studio/dom';
import type { EffectPreviews } from './studio/effect-preview';

/** Palette : celle des couleurs par couche du firmware (keymap.c), dans l'ordre de la maquette. */
const SWATCHES: readonly (readonly [string, readonly [number, number, number]])[] = [
  ['WHT', [255, 255, 255]],
  ['RED', [255, 0, 0]],
  ['ORG', [255, 100, 0]],
  ['YEL', [255, 255, 0]],
  ['GRN', [0, 255, 0]],
  ['BLU', [0, 0, 255]],
  ['PUR', [255, 0, 255]],
  ['GRY', [50, 50, 50]],
];

export const OFF_COLOR: LayerColor = [0, 0, 0];

export const cssColor = (c: readonly [number, number, number]): string =>
  `rgb(${String(c[0])} ${String(c[1])} ${String(c[2])})`;

export const hexColor = (c: readonly [number, number, number]): string =>
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
  /** Remplit toute la couche avec une couleur (null = tout transparent). */
  readonly onFill: (color: LayerColor) => void;
  /** Effet global (VialRGB), absent si le clavier ne l'expose pas. */
  readonly globalRgb: RgbController | undefined;
  readonly supportedEffects: readonly number[];
  readonly maxBrightness: number;
  readonly previews: EffectPreviews;
  /** Interrupteur « Éclairage allumé » : effet global différent de OFF. */
  readonly onLightingToggle: (on: boolean) => void;
  readonly onReset: () => void;
  readonly onError: (message: string) => void;
}

export function renderColorPanel(options: ColorPanelOptions): HTMLElement {
  const { lighting, layer } = options;
  const panel = h('div', { class: 'panel-part color-panel', 'aria-label': t('colors.label') });

  if (lighting) panel.append(...brushSection(options));
  else panel.append(h('p', { class: 'hint', text: t('colors.unsupported') }));

  // --- effet : celui de la couche s'il lui est propre, sinon l'effet global
  panel.append(h('div', { class: 'h', text: t('rgb.effect') }));
  const effect = lighting && layer > 0 ? lighting.effect(layer) : undefined;
  const own = h('input', { type: 'checkbox', class: 'toggle', id: 'effect-own' });
  own.checked = layer === 0 || Boolean(effect?.override);
  own.disabled = layer === 0 || !lighting;
  panel.append(
    h(
      'div',
      { class: 'group' },
      h('label', { class: 'item' }, h('span', { text: t('effect.ownShort') }), own),
    ),
  );

  const lightingSwitch = h('input', { type: 'checkbox', class: 'toggle', id: 'rgb-on' });
  const syncSwitch = (): void => {
    lightingSwitch.checked = (options.globalRgb?.mode.effect ?? 0) !== 0;
  };
  lightingSwitch.addEventListener('change', () => {
    options.onLightingToggle(lightingSwitch.checked);
  });

  if (layer > 0 && lighting && effect?.override) {
    const controller = new RgbController({ request: () => Promise.reject(new Error('inutilisé')) }, effect, {
      maxBrightness: options.maxBrightness,
      persistent: true,
      write: (mode) => lighting.setEffect(layer, { ...mode, override: true }),
      onError: (error) => {
        options.onError(errorMessage(error));
      },
    });
    panel.append(
      renderRgbPanel({
        controller,
        supportedEffects: options.supportedEffects,
        previews: options.previews,
        onError: options.onError,
      }),
    );
  } else if (options.globalRgb) {
    if (layer > 0) panel.append(h('p', { class: 'hint', text: t('effect.inherit') }));
    panel.append(
      renderRgbPanel({
        controller: options.globalRgb,
        supportedEffects: options.supportedEffects,
        previews: options.previews,
        onError: options.onError,
        onChange: syncSwitch,
      }),
    );
  } else {
    panel.append(h('p', { class: 'hint', text: t('rgb.unsupported') }));
  }

  own.addEventListener('change', () => {
    if (!lighting) return;
    const global = options.globalRgb?.mode ?? { effect: 0, speed: 0, hue: 0, saturation: 0, value: 0 };
    const next = own.checked
      ? { ...global, override: true }
      : { ...(lighting.effect(layer) ?? global), override: false };
    lighting.setEffect(layer, next).then(
      () => {
        panel.replaceWith(renderColorPanel(options));
      },
      (error: unknown) => {
        options.onError(errorMessage(error));
      },
    );
  });

  if (options.globalRgb) {
    syncSwitch();
    panel.append(
      h(
        'div',
        { class: 'group' },
        h('label', { class: 'item' }, h('span', { text: t('rgb.on') }), lightingSwitch),
      ),
    );
  }
  if (lighting) {
    const reset = h('button', { type: 'button', class: 'item', id: 'colors-reset', text: t('colors.reset') });
    reset.addEventListener('click', options.onReset);
    panel.append(h('div', { class: 'group' }, reset));
  }
  return panel;
}

function brushSection(options: ColorPanelOptions): HTMLElement[] {
  const current = h('small', { id: 'brush-current' });
  const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t('colors.brush') });
  const choices: { color: LayerColor; button: HTMLElement }[] = [];
  const choice = (color: LayerColor, label: string, className = ''): HTMLButtonElement => {
    const button = h('button', {
      type: 'button',
      class: `sw ${className}`.trim(),
      role: 'radio',
      title: label,
      'aria-label': label,
    });
    if (color) button.style.setProperty('--c', cssColor(color));
    button.addEventListener('click', () => {
      options.onBrush(color);
      sync(color);
    });
    choices.push({ color, button });
    return button;
  };
  swatches.append(choice(OFF_COLOR, t('colors.off')));
  for (const [name, rgb] of SWATCHES) swatches.append(choice(rgb, t(`colors.swatch.${name}` as MessageKey)));
  swatches.append(choice(null, t('colors.transparent'), 'trans'));
  const custom = h('input', { type: 'color', id: 'brush-custom', 'aria-label': t('colors.custom') });
  const customWrap = h('label', { class: 'sw custom', title: t('colors.custom') }, custom);
  custom.addEventListener('input', () => {
    const color = fromHex(custom.value);
    options.onBrush(color);
    sync(color);
  });
  swatches.append(customWrap);

  function sync(brush: LayerColor): void {
    let matched = false;
    for (const c of choices) {
      const on: boolean = sameColor(c.color, brush) && !matched;
      matched ||= on;
      c.button.setAttribute('aria-checked', String(on));
    }
    customWrap.setAttribute('aria-checked', String(!matched));
    if (brush) custom.value = hexColor(brush);
    current.textContent = brush === null ? t('colors.transparentShort') : hexColor(brush).toUpperCase();
  }
  sync(options.brush);

  const fill = h('button', { type: 'button', class: 'btn', id: 'colors-fill', text: t('colors.fill') });
  fill.addEventListener('click', () => {
    options.onFill(currentBrush());
  });
  const clear = h('button', { type: 'button', class: 'btn', id: 'colors-clear', text: t('colors.clear') });
  clear.addEventListener('click', () => {
    options.onFill(null);
  });
  // le pinceau courant est celui coché (options.brush n'est que la valeur de départ)
  function currentBrush(): LayerColor {
    const checked = choices.find((c) => c.button.getAttribute('aria-checked') === 'true');
    return checked ? checked.color : fromHex(custom.value);
  }

  return [
    h('div', { class: 'h' }, h('span', { text: t('colors.brush') }), current),
    swatches,
    h(
      'p',
      { class: 'hint', style: 'margin-top:-8px' },
      t('colors.hintStart'),
      h('kbd', { class: 'k', text: 'Alt' }),
      t('colors.hintEnd'),
    ),
    h('div', { class: 'btns', style: 'margin-top:-6px' }, fill, clear),
  ];
}
