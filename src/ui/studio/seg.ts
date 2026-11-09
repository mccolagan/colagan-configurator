// Contrôle segmenté façon iOS : un curseur (thumb) glisse sous l'option choisie.
import { h } from './dom';

export type SegRole = 'radio' | 'tab' | 'pressed';

export interface SegOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly title?: string;
  readonly id?: string;
}

export interface SegOptions<T extends string> {
  readonly label: string;
  readonly role: SegRole;
  readonly options: readonly SegOption<T>[];
  readonly value: T;
  readonly className?: string;
  readonly id?: string;
  readonly onChange: (value: T) => void;
}

const STATE_ATTR: Record<SegRole, string> = {
  radio: 'aria-checked',
  tab: 'aria-selected',
  pressed: 'aria-pressed',
};

export class Seg<T extends string> {
  readonly element: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly buttons = new Map<T, HTMLButtonElement>();
  private current: T;

  constructor(private readonly options: SegOptions<T>) {
    this.current = options.value;
    const role = options.role === 'radio' ? 'radiogroup' : options.role === 'tab' ? 'tablist' : undefined;
    this.element = h(options.role === 'pressed' ? 'nav' : 'div', {
      class: `seg ${options.className ?? ''}`.trim(),
      role,
      id: options.id,
      'aria-label': options.label,
    });
    this.thumb = h('span', { class: 'thumb', 'aria-hidden': 'true' });
    this.element.append(this.thumb);
    for (const option of options.options) {
      const button = h('button', {
        type: 'button',
        role: options.role === 'pressed' ? undefined : options.role,
        id: option.id,
        title: option.title,
        'data-value': option.value,
        text: option.label,
      });
      button.addEventListener('click', () => {
        this.set(option.value);
        options.onChange(option.value);
      });
      this.buttons.set(option.value, button);
      this.element.append(button);
    }
    this.set(options.value);
    // le curseur se cale une fois le contrôle affiché (largeurs connues)
    new ResizeObserver(() => {
      this.sync();
    }).observe(this.element);
  }

  get value(): T {
    return this.current;
  }

  button(value: T): HTMLButtonElement | undefined {
    return this.buttons.get(value);
  }

  set(value: T): void {
    this.current = value;
    const attr = STATE_ATTR[this.options.role];
    for (const [v, button] of this.buttons) button.setAttribute(attr, String(v === value));
    this.sync();
  }

  sync(): void {
    const on = this.buttons.get(this.current);
    if (!on?.offsetWidth) {
      this.thumb.style.width = '0';
      return;
    }
    this.thumb.style.width = `${String(on.offsetWidth)}px`;
    this.thumb.style.transform = `translateX(${String(on.offsetLeft - 3)}px)`;
  }
}
