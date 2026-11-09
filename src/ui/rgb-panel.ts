// Réglage d'un effet RGB : vignettes animées des effets, luminosité, vitesse, teinte, saturation.
import { t, type MessageKey } from '../i18n';
import { VIALRGB_EFFECTS } from '../keycodes/vial-v6.generated';
import type { RgbController } from '../rgb/rgb-controller';
import { errorMessage, h } from './studio/dom';
import type { EffectPreviews } from './studio/effect-preview';

export interface RgbPanelOptions {
  readonly controller: RgbController;
  readonly supportedEffects: readonly number[];
  readonly previews: EffectPreviews;
  readonly onError: (message: string) => void;
  /** Appelé après chaque changement envoyé (resynchronise l'interrupteur « Éclairage allumé »). */
  readonly onChange?: () => void;
}

export const effectId = (id: number): string => VIALRGB_EFFECTS.find((e) => e.id === id)?.name ?? '';

export function effectName(id: number): string {
  const name = effectId(id);
  if (!name) return `#${String(id)}`;
  try {
    return t(`rgb.effect.${name}` as MessageKey);
  } catch {
    return name;
  }
}

type SliderField = 'hue' | 'saturation' | 'value' | 'speed';

export function renderRgbPanel(options: RgbPanelOptions): HTMLElement {
  const { controller, previews } = options;
  const part = h('div', { class: 'panel-part rgb' });

  const grid = h('div', {
    class: 'fx-grid',
    role: 'radiogroup',
    id: 'rgb-effect',
    'aria-label': t('rgb.effect'),
  });
  const tiles = new Map<number, HTMLButtonElement>();
  previews.clear();
  for (const id of options.supportedEffects.filter((e) => e !== 0)) {
    const canvas = h('canvas', { width: 192, height: 80, 'aria-hidden': 'true' });
    const tile = h(
      'button',
      { type: 'button', class: 'fx', role: 'radio', 'data-effect': id },
      canvas,
      h('span', { text: effectName(id) }),
    );
    tile.addEventListener('click', () => {
      controller.update({ effect: id });
      sync();
    });
    tiles.set(id, tile);
    grid.append(tile);
    previews.add(canvas, effectId(id));
  }

  const sliders = new Map<SliderField, { input: HTMLInputElement; output: HTMLOutputElement }>();
  const slider = (field: SliderField, label: string, max: number, note?: string): HTMLElement => {
    const id = `rgb-${field}`;
    const input = h('input', { type: 'range', id, min: 0, max });
    const output = h('output', { for: id });
    input.addEventListener('input', () => {
      controller.update({ [field]: Number(input.value) });
      sync();
    });
    sliders.set(field, { input, output });
    return h(
      'div',
      { class: 'slider' },
      h('label', { for: id, text: label }),
      output,
      input,
      note ? h('small', { text: note }) : null,
    );
  };
  const group = h(
    'div',
    { class: 'group' },
    slider(
      'value',
      t('rgb.brightnessShort'),
      controller.maxBrightness,
      t('rgb.brightnessNote', { max: controller.maxBrightness }),
    ),
    slider('speed', t('rgb.speed'), 255),
    slider('hue', t('rgb.hue'), 255),
    slider('saturation', t('rgb.saturation'), 255),
  );

  const save = h('button', { type: 'button', class: 'btn primary', id: 'rgb-save', text: t('rgb.save') });
  const revert = h('button', { type: 'button', class: 'btn', id: 'rgb-revert', text: t('rgb.revert') });
  const state = h('p', { class: 'state-line', id: 'rgb-state', role: 'status', 'aria-live': 'polite' });
  const run = async (action: () => Promise<void>, done?: string): Promise<void> => {
    save.disabled = revert.disabled = true;
    try {
      await action();
      sync(done);
    } catch (error) {
      options.onError(t('rgb.error', { message: errorMessage(error) }));
      sync();
    }
  };
  save.addEventListener('click', () => void run(() => controller.save(), t('rgb.saved')));
  revert.addEventListener('click', () => void run(() => controller.revert()));
  const actions = h('div', { class: 'btns' }, save, revert);
  // effet de couche : écrit et enregistré à chaque changement
  actions.hidden = controller.persistent;

  part.append(grid, group, actions, state);

  function sync(message?: string): void {
    const mode = controller.mode;
    for (const [id, tile] of tiles) tile.setAttribute('aria-checked', String(id === mode.effect));
    for (const [field, { input, output }] of sliders) {
      input.value = String(mode[field]);
      output.textContent =
        field === 'value'
          ? `${String(mode.value)} / ${String(controller.maxBrightness)}`
          : String(mode[field]);
    }
    const dirty = controller.dirty;
    save.disabled = revert.disabled = !dirty;
    state.dataset.level = dirty ? 'warn' : 'ok';
    state.textContent =
      message ?? (controller.persistent ? t('rgb.layerSaved') : dirty ? t('rgb.dirty') : t('rgb.clean'));
    options.onChange?.();
  }

  sync();
  return part;
}
