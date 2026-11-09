// Notifications en pastilles de verre, en bas au centre (deux au plus), avec une action facultative.
import { h } from './dom';

export type ToastLevel = 'ok' | 'info' | 'warn' | 'error';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export class Toasts {
  readonly element: HTMLElement;

  constructor() {
    this.element = h('div', { id: 'toasts' });
  }

  show(text: string, level: ToastLevel = 'info', action?: ToastAction): void {
    const toast = h(
      'div',
      { class: `toast glass ${level}${action ? ' has-action' : ''}` },
      h('span', { class: 't', text }),
    );
    if (action) {
      const button = h('button', { type: 'button', text: action.label });
      button.addEventListener('click', () => {
        action.run();
        toast.remove();
      });
      toast.append(button);
    }
    this.element.append(toast);
    while (this.element.children.length > 2) this.element.firstElementChild?.remove();
    const ttl = level === 'error' ? 7000 : level === 'warn' ? 4500 : 2600;
    setTimeout(() => {
      toast.classList.add('is-leaving');
      setTimeout(() => {
        toast.remove();
      }, 420);
    }, ttl);
  }
}
