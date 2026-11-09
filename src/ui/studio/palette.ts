// Palette de commandes (Ctrl+K) entourée de la lueur Siri.
import { t } from '../../i18n';
import { fold, h, icon } from './dom';

export interface Command {
  readonly label: string;
  readonly hint: string;
  readonly run: () => void;
}

export class CommandPalette {
  readonly element: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private items: Command[] = [];
  private index = 0;
  private returnFocus: Element | null = null;

  constructor(private readonly commands: () => readonly Command[]) {
    this.input = h('input', {
      type: 'text',
      placeholder: t('palette.placeholder'),
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-controls': 'palette-list',
      'aria-label': t('palette.label'),
    });
    this.list = h('ul', { id: 'palette-list', role: 'listbox' });
    const box = h(
      'div',
      { class: 'palette glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('palette.label') },
      h('div', { class: 'pal-in' }, icon('search', 18, 2.2), this.input),
      this.list,
    );
    this.element = h('div', { class: 'scrim', id: 'palette', hidden: true }, box);
    this.element.addEventListener('pointerdown', (event) => {
      if (event.target === this.element) this.close();
    });
    this.input.addEventListener('input', () => {
      this.index = 0;
      this.render();
    });
    this.input.addEventListener('keydown', (event) => {
      const count = Math.max(1, this.items.length);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.index = (this.index + 1) % count;
        this.render();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.index = (this.index - 1 + count) % count;
        this.render();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this.run(this.index);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    this.list.addEventListener('click', (event) => {
      const li = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-n]') : null;
      if (li) this.run(Number(li.dataset.n));
    });
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  show(): void {
    this.returnFocus = document.activeElement;
    this.element.hidden = false;
    this.input.value = '';
    this.index = 0;
    this.render();
    this.input.focus();
  }

  close(): void {
    this.element.hidden = true;
    if (this.returnFocus instanceof HTMLElement) this.returnFocus.focus();
  }

  private run(n: number): void {
    const command = this.items[n];
    this.close();
    command?.run();
  }

  private render(): void {
    const words = fold(this.input.value).split(/\s+/).filter(Boolean);
    this.items = this.commands().filter((c) => words.every((w) => fold(`${c.label} ${c.hint}`).includes(w)));
    this.index = Math.min(this.index, Math.max(0, this.items.length - 1));
    if (!this.items.length) {
      this.list.replaceChildren(h('li', { 'aria-disabled': 'true', text: t('palette.none') }));
      return;
    }
    this.list.replaceChildren(
      ...this.items.map((c, n) =>
        h(
          'li',
          { role: 'option', 'data-n': n, 'aria-selected': String(n === this.index) },
          c.label,
          h('small', { text: c.hint }),
        ),
      ),
    );
    this.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
}
