// Onglet « Macros & co » : éditeurs de macros, tap-dance et combos, écrits dans le clavier avec annulation.
import type { DynamicState } from '../editor/dynamic-state';
import type { KeyEditor } from '../editor/key-editor';
import { hasNonAscii, textToAzertyTaps } from '../editor/macro-text';
import { t, type MessageKey } from '../i18n';
import type { KeycodeCatalog } from '../keycodes/catalog';
import { flatLabel, keyLabel, type LabelLayout } from '../keycodes/labels';
import type { Macro, MacroAction } from '../protocol/macro';
import type { Combo, TapDance } from '../protocol/vial';
import { pickKeycode } from './keycode-dialog';

type Level = 'ok' | 'warn' | 'error' | 'info';

export interface DynamicPanelOptions {
  readonly catalog: KeycodeCatalog;
  readonly layout: LabelLayout;
  readonly state: DynamicState;
  readonly editor: KeyEditor;
  readonly report: (level: Level, message: string) => void;
  /** Après chaque écriture : boutons annuler / rétablir à jour. */
  readonly onChanged: () => void;
}

type Tab = 'macros' | 'tapDance' | 'combos';

type DraftAction =
  | { type: 'text'; text: string }
  | { type: 'tap' | 'down' | 'up'; keys: string[] }
  | { type: 'delay'; ms: number };

const toDraft = (macro: Macro): DraftAction[] =>
  macro.map((action): DraftAction => {
    const [tag, ...args] = action;
    if (tag === 'text') return { type: 'text', text: String(args[0]) };
    if (tag === 'delay') return { type: 'delay', ms: Number(args[0]) };
    return { type: tag, keys: args.map(String) };
  });

const fromDraft = (draft: readonly DraftAction[]): Macro =>
  draft.map((a): MacroAction => {
    if (a.type === 'text') return ['text', a.text];
    if (a.type === 'delay') return ['delay', a.ms];
    return [a.type, ...a.keys];
  });

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Pick<HTMLElement, 'className' | 'textContent' | 'title' | 'id'>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function moveItem(list: unknown[], from: number, to: number): void {
  const [item] = list.splice(from, 1);
  if (item !== undefined) list.splice(to, 0, item);
}

function button(label: string, onClick: () => void, className = 'secondary'): HTMLButtonElement {
  const b = el('button', { className, textContent: label });
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export class DynamicPanel {
  readonly element: HTMLElement;
  private tab: Tab = 'macros';
  private macroIndex = 0;
  private draft: DraftAction[] = [];
  private dirty = false;
  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;

  constructor(private readonly options: DynamicPanelOptions) {
    this.element = el('section', { className: 'dynamic' });
    this.element.setAttribute('aria-label', t('view.dynamic'));
    this.tabs = el('div', { className: 'tabs' });
    this.tabs.setAttribute('role', 'tablist');
    this.body = el('div', { className: 'dynamic__body' });
    this.element.append(this.tabs, this.body);
    this.loadDraft();
    this.render();
  }

  /** Après annuler / rétablir ou import : on relit l'état (un brouillon de macro non enregistré est gardé). */
  refresh(): void {
    if (!this.dirty) this.loadDraft();
    this.render();
  }

  private label(code: number): string {
    return code === 0 ? '—' : flatLabel(keyLabel(this.options.catalog, code, this.options.layout)) || '?';
  }

  private slot(code: number, title: string, onPick: (code: number) => void): HTMLButtonElement {
    const b = button(
      this.label(code),
      () => {
        void pickKeycode(this.options.catalog, this.options.layout, title).then((picked) => {
          if (picked !== undefined) onPick(picked);
        });
      },
      'keycode slot',
    );
    b.title = `${title} : ${this.options.catalog.serialize(code)}`;
    b.setAttribute('aria-label', `${title} : ${this.options.catalog.serialize(code)}`);
    return b;
  }

  /** Écrit via l'éditeur (historique) ; renvoie false en cas d'échec, déjà signalé. */
  private async write(change: Parameters<KeyEditor['change']>[0], message: string): Promise<boolean> {
    let ok = true;
    try {
      if (await this.options.editor.change(change)) this.options.report('ok', message);
    } catch (error) {
      ok = false;
      this.options.report(
        'error',
        t('edit.error', { message: error instanceof Error ? error.message : String(error) }),
      );
    }
    this.options.onChanged();
    return ok;
  }

  private writeEntry(change: Parameters<KeyEditor['change']>[0], message: string): void {
    void this.write(change, message).then(() => {
      this.refresh();
    });
  }

  private render(): void {
    const entries: [Tab, MessageKey][] = [
      ['macros', 'dyn.macros'],
      ['tapDance', 'dyn.tapDance'],
      ['combos', 'dyn.combos'],
    ];
    this.tabs.replaceChildren(
      ...entries.map(([id, key]) => {
        const tab = button(
          t(key),
          () => {
            this.tab = id;
            this.render();
          },
          '',
        );
        tab.setAttribute('role', 'tab');
        tab.dataset.dyn = id;
        tab.setAttribute('aria-selected', String(id === this.tab));
        return tab;
      }),
    );
    this.body.replaceChildren(
      this.tab === 'macros'
        ? this.renderMacros()
        : this.tab === 'tapDance'
          ? this.renderTapDance()
          : this.renderCombos(),
    );
  }

  // --- tap-dance -------------------------------------------------------------------------------------------

  private renderTapDance(): HTMLElement {
    const { state } = this.options;
    const fields: [keyof Omit<TapDance, 'tappingTerm'>, MessageKey][] = [
      ['onTap', 'dyn.tdTap'],
      ['onHold', 'dyn.tdHold'],
      ['onDoubleTap', 'dyn.tdDouble'],
      ['onTapHold', 'dyn.tdTapHold'],
    ];
    const table = el('table', { className: 'dyn-table', id: 'tap-dance' });
    const head = el(
      'tr',
      {},
      el('th', { textContent: '' }),
      ...fields.map(([, key]) => el('th', { textContent: t(key) })),
      el('th', { textContent: t('dyn.tdTerm') }),
    );
    table.append(el('thead', {}, head));
    const tbody = el('tbody');
    state.tapDance.forEach((td, index) => {
      const name = `TD(${String(index)})`;
      const update = (after: TapDance): void => {
        this.writeEntry({ kind: 'tapDance', index, before: td, after }, t('dyn.tdWritten', { name }));
      };
      const term = el('input');
      term.type = 'number';
      term.min = '0';
      term.max = '10000';
      term.value = String(td.tappingTerm);
      term.setAttribute('aria-label', `${name} ${t('dyn.tdTerm')}`);
      term.addEventListener('change', () => {
        const value = Math.max(0, Math.min(10000, Math.round(Number(term.value))));
        update({ ...td, tappingTerm: value });
      });
      const used = fields.some(([field]) => td[field] !== 0);
      const row = el(
        'tr',
        { className: used ? 'is-used' : '' },
        el('th', { textContent: name }),
        ...fields.map(([field, key]) =>
          el(
            'td',
            {},
            this.slot(td[field], `${name} · ${t(key)}`, (code) => {
              update({ ...td, [field]: code });
            }),
          ),
        ),
        el('td', {}, term),
      );
      row.dataset.index = String(index);
      tbody.append(row);
    });
    table.append(tbody);
    return el(
      'div',
      {},
      el('p', { className: 'dyn-help', textContent: t('dyn.tdHelp') }),
      el('div', { className: 'dyn-scroll' }, table),
    );
  }

  // --- combos ----------------------------------------------------------------------------------------------

  private renderCombos(): HTMLElement {
    const { state } = this.options;
    const table = el('table', { className: 'dyn-table', id: 'combos' });
    table.append(
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', { textContent: '' }),
          ...[1, 2, 3, 4].map((n) => el('th', { textContent: t('dyn.comboKey', { n }) })),
          el('th', { textContent: t('dyn.comboOutput') }),
        ),
      ),
    );
    const tbody = el('tbody');
    state.combos.forEach((combo, index) => {
      const name = t('dyn.comboName', { n: index });
      const update = (after: Combo): void => {
        this.writeEntry({ kind: 'combo', index, before: combo, after }, t('dyn.comboWritten', { name }));
      };
      const keys = combo.keys.map((code, k) =>
        el(
          'td',
          {},
          this.slot(code, `${name} · ${t('dyn.comboKey', { n: k + 1 })}`, (picked) => {
            const next = [...combo.keys] as Combo['keys'];
            next[k] = picked;
            update({ keys: next, output: combo.output });
          }),
        ),
      );
      const output = el(
        'td',
        {},
        this.slot(combo.output, `${name} · ${t('dyn.comboOutput')}`, (picked) => {
          update({ keys: [...combo.keys] as Combo['keys'], output: picked });
        }),
      );
      const used = combo.output !== 0 || combo.keys.some((k) => k !== 0);
      const row = el(
        'tr',
        { className: used ? 'is-used' : '' },
        el('th', { textContent: name }),
        ...keys,
        output,
      );
      row.dataset.index = String(index);
      tbody.append(row);
    });
    table.append(tbody);
    return el(
      'div',
      {},
      el('p', { className: 'dyn-help', textContent: t('dyn.comboHelp') }),
      el('div', { className: 'dyn-scroll' }, table),
    );
  }

  // --- macros ----------------------------------------------------------------------------------------------

  private loadDraft(): void {
    this.draft = toDraft(this.options.state.macros()[this.macroIndex] ?? []);
    this.dirty = false;
  }

  private summary(macro: Macro): string {
    if (!macro.length) return t('dyn.macroEmpty');
    return macro
      .map(([tag, ...args]) =>
        tag === 'text'
          ? `« ${String(args[0])} »`
          : tag === 'delay'
            ? `${String(args[0])} ms`
            : `${tag} ${args.join(' ')}`,
      )
      .join(', ')
      .slice(0, 60);
  }

  private editDraft(mutate: () => void): void {
    mutate();
    this.dirty = true;
    this.render();
  }

  private renderMacros(): HTMLElement {
    const { state, catalog } = this.options;
    const macros = state.macros();

    const list = el('ul', { className: 'macro-list', id: 'macro-list' });
    macros.forEach((macro, index) => {
      const item = button(
        `M${String(index)} · ${this.summary(macro)}`,
        () => {
          if (this.dirty && index !== this.macroIndex) {
            this.options.report('warn', t('dyn.macroUnsaved'));
            return;
          }
          this.macroIndex = index;
          this.loadDraft();
          this.render();
        },
        index === this.macroIndex ? 'macro-list__item is-selected' : 'macro-list__item secondary',
      );
      item.dataset.macro = String(index);
      list.append(el('li', {}, item));
    });

    const name = `M${String(this.macroIndex)}`;
    const editor = el('div', { className: 'macro-editor', id: 'macro-editor' });
    editor.append(el('h3', { textContent: t('dyn.macroTitle', { name }) }));

    this.draft.forEach((action, i) => {
      const row = el('div', { className: 'macro-action' });
      row.dataset.action = action.type;
      row.append(
        el('span', {
          className: 'macro-action__type',
          textContent: t(`dyn.act.${action.type}` as MessageKey),
        }),
      );
      if (action.type === 'text') {
        const input = el('input');
        input.type = 'text';
        input.value = action.text;
        input.setAttribute('aria-label', t('dyn.act.text'));
        input.addEventListener('input', () => {
          action.text = input.value;
          this.dirty = true;
          this.updateFooter();
        });
        row.append(input);
        const warnText = el('span', {
          textContent: t(hasNonAscii(action.text) ? 'dyn.textNonAscii' : 'dyn.textQwerty'),
        });
        // mis à jour sur place : redessiner au « change » ferait perdre le clic sur « Convertir »
        input.addEventListener('input', () => {
          warnText.textContent = t(hasNonAscii(input.value) ? 'dyn.textNonAscii' : 'dyn.textQwerty');
        });
        const warn = el('p', { className: 'macro-action__warn' }, warnText, ' ');
        warn.append(
          button(t('dyn.convertAzerty'), () => {
            const { action: taps, missing } = textToAzertyTaps(action.text, catalog);
            this.editDraft(() => {
              this.draft.splice(i, 1, ...toDraft([taps]));
            });
            if (missing.length)
              this.options.report('warn', t('dyn.convertMissing', { chars: missing.join(' ') }));
          }),
        );
        row.append(warn);
      } else if (action.type === 'delay') {
        const input = el('input');
        input.type = 'number';
        input.min = '0';
        input.max = '65000';
        input.value = String(action.ms);
        input.setAttribute('aria-label', t('dyn.act.delay'));
        input.addEventListener('change', () => {
          this.editDraft(() => {
            action.ms = Math.max(0, Math.min(65000, Math.round(Number(input.value))));
          });
        });
        row.append(input, el('span', { textContent: 'ms' }));
      } else {
        const chips = el('span', { className: 'macro-action__keys' });
        action.keys.forEach((key, k) => {
          let code = 0;
          try {
            code = catalog.deserialize(key);
          } catch {
            // nom inconnu venu d'un fichier : affiché tel quel
          }
          const chip = button(
            code ? this.label(code) : key,
            () => {
              this.editDraft(() => {
                action.keys.splice(k, 1);
              });
            },
            'keycode chip',
          );
          chip.title = t('dyn.removeKey', { name: key });
          chips.append(chip);
        });
        chips.append(
          button(
            '+',
            () => {
              void pickKeycode(catalog, this.options.layout, t('dyn.addKey')).then((picked) => {
                if (picked !== undefined) {
                  this.editDraft(() => {
                    action.keys.push(catalog.serialize(picked));
                  });
                }
              });
            },
            'keycode chip chip--add',
          ),
        );
        row.append(chips);
      }
      const tools = el('span', { className: 'macro-action__tools' });
      tools.append(
        button('↑', () => {
          if (i > 0)
            this.editDraft(() => {
              moveItem(this.draft, i, i - 1);
            });
        }),
        button('↓', () => {
          if (i < this.draft.length - 1)
            this.editDraft(() => {
              moveItem(this.draft, i, i + 1);
            });
        }),
        button('✕', () => {
          this.editDraft(() => this.draft.splice(i, 1));
        }),
      );
      tools.querySelectorAll('button').forEach((b, n) => {
        b.setAttribute('aria-label', t((['dyn.up', 'dyn.down', 'dyn.remove'] as const)[n] ?? 'dyn.remove'));
      });
      row.append(tools);
      editor.append(row);
    });
    if (!this.draft.length)
      editor.append(el('p', { className: 'dyn-help', textContent: t('dyn.macroEmptyHelp') }));

    const add = el('div', { className: 'actions macro-add' });
    const adders: [DraftAction['type'], () => DraftAction][] = [
      ['text', () => ({ type: 'text', text: '' })],
      ['tap', () => ({ type: 'tap', keys: [] })],
      ['down', () => ({ type: 'down', keys: [] })],
      ['up', () => ({ type: 'up', keys: [] })],
      ['delay', () => ({ type: 'delay', ms: 50 })],
    ];
    for (const [type, make] of adders) {
      add.append(
        button(`+ ${t(`dyn.act.${type}` as MessageKey)}`, () => {
          this.editDraft(() => this.draft.push(make()));
        }),
      );
    }
    editor.append(add);

    const footer = el('div', { className: 'actions macro-footer' });
    const usage = el('span', { className: 'macro-usage', id: 'macro-usage' });
    const save = button(t('dyn.macroSave'), () => void this.saveMacro(), '');
    save.id = 'macro-save';
    const reset = button(t('dyn.macroRevert'), () => {
      this.loadDraft();
      this.render();
    });
    reset.id = 'macro-revert';
    footer.append(usage, save, reset);
    editor.append(footer);
    this.footer = { usage, save, reset };
    this.updateFooter();

    return el(
      'div',
      { className: 'macros' },
      el('p', { className: 'dyn-help', textContent: t('dyn.macroHelp') }),
      el('div', { className: 'macros__layout' }, list, editor),
    );
  }

  private footer: { usage: HTMLElement; save: HTMLButtonElement; reset: HTMLButtonElement } | undefined;

  private updateFooter(): void {
    if (!this.footer) return;
    const { state } = this.options;
    let size: number;
    try {
      size = state.bufferWith(this.macroIndex, fromDraft(this.draft)).length;
    } catch {
      size = Number.NaN;
    }
    const tooBig = !(size <= state.macroCapacity);
    this.footer.usage.textContent = t('dyn.macroUsage', {
      used: Number.isNaN(size) ? '?' : size,
      max: state.macroCapacity,
    });
    this.footer.usage.dataset.level = tooBig ? 'error' : 'info';
    this.footer.save.disabled = !this.dirty || tooBig;
    this.footer.reset.disabled = !this.dirty;
  }

  private async saveMacro(): Promise<void> {
    const { state } = this.options;
    const index = this.macroIndex;
    const after = state.bufferWith(
      index,
      fromDraft(this.draft.filter((a) => a.type !== 'text' || a.text !== '')),
    );
    const ok = await this.write(
      { kind: 'macros', index, before: state.macroBuffer, after },
      t('dyn.macroWritten', { name: `M${String(index)}` }),
    );
    // en cas d'échec (déverrouillage refusé…), le brouillon reste à l'écran pour réessayer
    if (ok) this.dirty = false;
    this.refresh();
  }
}
