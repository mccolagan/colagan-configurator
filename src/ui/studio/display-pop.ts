// Fenêtre « Affichage » : éclairage montré sur le dessin, étiquettes, thème, géométrie du split et coque.
import type { LedDisplay } from '../../env/led-preview-pref';
import type { ThemeChoice } from '../../env/theme';
import { t, type MessageKey } from '../../i18n';
import type { LabelLayout } from '../../keycodes/labels';
import { h } from './dom';
import { Seg } from './seg';

export interface Split {
  gap: number;
  tent: number;
  splay: number;
}

export const DEFAULT_SPLIT: Readonly<Split> = { gap: 3.5, tent: 0, splay: 0 };

export interface DisplayOptions {
  readonly ledDisplay: LedDisplay;
  readonly onLedDisplay: (value: LedDisplay) => void;
  readonly layout: LabelLayout;
  readonly onLayout: (value: LabelLayout) => void;
  readonly theme: ThemeChoice;
  readonly onTheme: (value: ThemeChoice) => void;
  readonly split: Split;
  readonly onSplit: (split: Split) => void;
  readonly caseOn: boolean;
  readonly onCase: (on: boolean) => void;
}

const LED_CHOICES: readonly (readonly [LedDisplay, MessageKey, MessageKey | undefined])[] = [
  ['layer', 'led.layer', 'led.layerHint'],
  ['live', 'led.live', 'led.liveHint'],
  ['off', 'led.off', undefined],
];

export class DisplayPop {
  readonly element: HTMLElement;
  readonly ledStatus: HTMLElement;
  private readonly ledButtons = new Map<LedDisplay, HTMLButtonElement>();
  private readonly sceneParts: HTMLElement[] = [];
  private readonly segs: Seg<string>[] = [];
  private readonly sliders: { field: keyof Split; input: HTMLInputElement; output: HTMLOutputElement }[] = [];
  private readonly caseToggle: HTMLInputElement;

  constructor(private readonly options: DisplayOptions) {
    this.element = h('div', {
      class: 'pop glass',
      id: 'display-pop',
      role: 'dialog',
      'aria-label': t('display.title'),
      hidden: true,
    });

    const led = h('div', {
      class: 'group',
      role: 'radiogroup',
      id: 'led-display',
      'aria-label': t('led.display'),
    });
    for (const [value, label, hint] of LED_CHOICES) {
      const button = h(
        'button',
        {
          type: 'button',
          class: 'item',
          role: 'radio',
          title: hint ? t(hint) : undefined,
          'data-value': value,
        },
        h('span', { text: t(label) }),
        h('span', { class: 'v check', 'aria-hidden': 'true' }),
      );
      button.addEventListener('click', () => {
        this.setLed(value);
        options.onLedDisplay(value);
      });
      this.ledButtons.set(value, button);
      led.append(button);
    }
    this.ledStatus = h('p', { class: 'state-line', id: 'led-status', role: 'status', 'aria-live': 'polite' });
    this.setLed(options.ledDisplay);

    const labels = new Seg<LabelLayout>({
      label: t('labels.label'),
      role: 'radio',
      id: 'labels',
      className: 'plain small fill',
      options: [
        { value: 'azerty', label: t('labels.azerty') },
        { value: 'qwerty', label: t('labels.qwertyShort'), title: t('labels.qwerty') },
      ],
      value: options.layout,
      onChange: options.onLayout,
    });
    const theme = new Seg<ThemeChoice>({
      label: t('theme.label'),
      role: 'radio',
      id: 'theme',
      className: 'plain small fill',
      options: [
        { value: 'auto', label: t('theme.auto') },
        { value: 'light', label: t('theme.light') },
        { value: 'dark', label: t('theme.dark') },
      ],
      value: options.theme,
      onChange: options.onTheme,
    });
    this.segs.push(labels as Seg<string>, theme as Seg<string>);

    const slider = (
      field: keyof Split,
      label: MessageKey,
      min: number,
      max: number,
      step: number,
    ): HTMLElement => {
      const id = `split-${field}`;
      const input = h('input', { type: 'range', id, min, max, step, value: options.split[field] });
      const output = h('output', { for: id });
      input.addEventListener('input', () => {
        options.split[field] = Number(input.value);
        this.syncSliders();
        options.onSplit(options.split);
      });
      this.sliders.push({ field, input, output });
      return h('div', { class: 'slider' }, h('label', { for: id, text: t(label) }), output, input);
    };
    this.caseToggle = h('input', { type: 'checkbox', class: 'toggle', id: 'case-on' });
    this.caseToggle.checked = options.caseOn;
    this.caseToggle.addEventListener('change', () => {
      options.onCase(this.caseToggle.checked);
    });
    const reset = h('button', { type: 'button', class: 'btn', id: 'split-reset', text: t('display.reset') });
    reset.addEventListener('click', () => {
      this.resetSplit();
    });
    const geometry = [
      h('div', { class: 'h', text: t('display.geometry') }),
      h(
        'div',
        { class: 'group' },
        slider('gap', 'display.gap', 0, 8, 0.1),
        slider('tent', 'display.tent', 0, 30, 1),
        slider('splay', 'display.splay', 0, 24, 1),
      ),
      h(
        'div',
        { class: 'group' },
        h('label', { class: 'item' }, h('span', { text: t('display.case') }), this.caseToggle),
      ),
      h('div', { class: 'btns' }, reset),
    ];
    this.sceneParts.push(...geometry);
    this.syncSliders();

    this.element.append(
      h('div', { class: 'h', text: t('led.display') }),
      led,
      this.ledStatus,
      h('div', { class: 'h', text: t('labels.label') }),
      labels.element,
      h('div', { class: 'h', text: t('theme.label') }),
      theme.element,
      ...geometry,
    );
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  toggle(force?: boolean): void {
    this.element.hidden = !(force ?? this.element.hidden);
    if (!this.element.hidden) for (const seg of this.segs) seg.sync();
  }

  /** Réglages de la scène 3D (géométrie, coque) : masqués en vue « Plan » ou sans clavier. */
  showSceneControls(visible: boolean): void {
    for (const part of this.sceneParts) part.hidden = !visible;
  }

  setLed(value: LedDisplay): void {
    for (const [v, button] of this.ledButtons) {
      button.setAttribute('aria-checked', String(v === value));
      const check = button.querySelector('.check');
      if (check) check.textContent = v === value ? '✓' : '';
    }
  }

  setCase(on: boolean): void {
    this.caseToggle.checked = on;
  }

  resetSplit(): void {
    Object.assign(this.options.split, DEFAULT_SPLIT);
    for (const { field, input } of this.sliders) input.value = String(this.options.split[field]);
    this.syncSliders();
    this.options.onSplit(this.options.split);
  }

  private syncSliders(): void {
    for (const { field, output } of this.sliders) {
      const value = this.options.split[field];
      output.textContent = field === 'gap' ? `${(value * 19.05).toFixed(0)} mm` : `${String(value)}°`;
    }
  }
}
