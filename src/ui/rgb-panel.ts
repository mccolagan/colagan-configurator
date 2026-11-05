// Panneau « Éclairage RGB » : effet, couleur, luminosité, vitesse, envoyés en direct au clavier.
import { t, type MessageKey } from '../i18n';
import { VIALRGB_EFFECTS } from '../keycodes/vial-v6.generated';
import type { RgbController } from '../rgb/rgb-controller';

export interface RgbPanelOptions {
  readonly controller: RgbController;
  readonly supportedEffects: readonly number[];
  /** Noms des couches où des ledmaps masquent l'effet (rappel affiché), vide sinon. */
  readonly ledmapLayers: readonly string[];
  readonly onError: (message: string) => void;
}

export function effectName(id: number): string {
  const effect = VIALRGB_EFFECTS.find((e) => e.id === id);
  if (!effect) return `#${String(id)}`;
  const key = `rgb.effect.${effect.name}`;
  try {
    return t(key as MessageKey);
  } catch {
    return effect.name;
  }
}

type SliderField = 'hue' | 'saturation' | 'value' | 'speed';

export function renderRgbPanel(options: RgbPanelOptions): HTMLElement {
  const { controller } = options;
  const panel = document.createElement('section');
  panel.className = 'rgb';
  panel.setAttribute('aria-label', t('effect.global'));

  const effect = document.createElement('select');
  effect.id = 'rgb-effect';
  // OFF (0) n'est jamais listé par le firmware mais toujours accepté
  for (const id of [0, ...options.supportedEffects.filter((e) => e !== 0)]) {
    const option = document.createElement('option');
    option.value = String(id);
    option.textContent = effectName(id);
    effect.append(option);
  }
  effect.addEventListener('change', () => {
    controller.update({ effect: Number(effect.value) });
    sync();
  });

  const swatch = document.createElement('span');
  swatch.className = 'rgb__swatch';
  swatch.setAttribute('aria-hidden', 'true');

  const sliders = new Map<SliderField, HTMLInputElement>();
  const slider = (field: SliderField, label: string, max: number): HTMLLabelElement => {
    const wrapper = document.createElement('label');
    wrapper.className = `rgb__field rgb__field--${field}`;
    const caption = document.createElement('span');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `rgb-${field}`;
    input.min = '0';
    input.max = String(max);
    input.addEventListener('input', () => {
      controller.update({ [field]: Number(input.value) });
      sync();
    });
    const output = document.createElement('output');
    output.htmlFor.add(input.id);
    wrapper.append(caption, input, output);
    sliders.set(field, input);
    return wrapper;
  };

  const effectField = document.createElement('label');
  effectField.className = 'rgb__field';
  const effectCaption = document.createElement('span');
  effectCaption.textContent = t('rgb.effect');
  effectField.append(effectCaption, effect);

  const fields = document.createElement('div');
  fields.className = 'rgb__fields';
  fields.append(
    effectField,
    slider('hue', t('rgb.hue'), 255),
    slider('saturation', t('rgb.saturation'), 255),
    slider('value', t('rgb.brightness', { max: controller.maxBrightness }), controller.maxBrightness),
    slider('speed', t('rgb.speed'), 255),
  );

  const save = document.createElement('button');
  save.type = 'button';
  save.id = 'rgb-save';
  save.textContent = t('rgb.save');
  const revert = document.createElement('button');
  revert.type = 'button';
  revert.id = 'rgb-revert';
  revert.className = 'secondary';
  revert.textContent = t('rgb.revert');
  const state = document.createElement('p');
  state.className = 'status rgb__state';
  state.id = 'rgb-state';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');

  const run = async (action: () => Promise<void>, done?: string): Promise<void> => {
    save.disabled = revert.disabled = true;
    try {
      await action();
      sync(done);
    } catch (error) {
      options.onError(t('rgb.error', { message: error instanceof Error ? error.message : String(error) }));
      sync();
    }
  };
  save.addEventListener('click', () => void run(() => controller.save(), t('rgb.saved')));
  revert.addEventListener('click', () => void run(() => controller.revert()));

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(swatch, save, revert);

  if (controller.persistent) {
    // effet de couche : écrit et enregistré à chaque changement
    save.hidden = revert.hidden = true;
  }
  panel.append(fields, actions, state);
  if (options.ledmapLayers.length) {
    const note = document.createElement('p');
    note.className = 'rgb__note';
    note.textContent = t('rgb.layerNote', { layers: options.ledmapLayers.join(', ') });
    panel.append(note);
  }

  function sync(message?: string): void {
    const mode = controller.mode;
    effect.value = String(mode.effect);
    for (const [field, input] of sliders) {
      input.value = String(mode[field]);
      const output = input.nextElementSibling;
      if (output) output.textContent = String(mode[field]);
    }
    // aperçu : teinte / saturation QMK (0-255) converties en HSL CSS
    const hue = Math.round((mode.hue / 255) * 360);
    const saturation = Math.round((mode.saturation / 255) * 100);
    swatch.style.background = `hsl(${String(hue)} ${String(saturation)}% ${String(100 - saturation / 2)}%)`;
    const dirty = controller.dirty;
    save.disabled = revert.disabled = !dirty;
    state.dataset.level = dirty ? 'warn' : 'ok';
    state.textContent =
      message ?? (controller.persistent ? t('rgb.layerSaved') : dirty ? t('rgb.dirty') : t('rgb.clean'));
  }

  sync();
  return panel;
}
