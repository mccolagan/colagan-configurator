// Panneau de choix d'un keycode : catégories, recherche (nom ou caractère AZERTY), saisie avancée.
import { t, type MessageKey } from '../i18n';
import type { KeycodeCatalog, KeycodeEntry, KeycodeGroup } from '../keycodes/catalog';
import { azertySearchChars, flatLabel, keyLabel, type LabelLayout } from '../keycodes/labels';

interface Category {
  readonly id: string;
  readonly label: MessageKey;
  readonly groups: readonly KeycodeGroup[];
}

const CATEGORIES: readonly Category[] = [
  { id: 'basic', label: 'picker.cat.basic', groups: ['special', 'basic'] },
  { id: 'symbols', label: 'picker.cat.symbols', groups: ['shifted', 'iso'] },
  { id: 'layers', label: 'picker.cat.layers', groups: ['layers'] },
  { id: 'modifiers', label: 'picker.cat.modifiers', groups: ['modifiers'] },
  { id: 'media', label: 'picker.cat.media', groups: ['media'] },
  { id: 'lighting', label: 'picker.cat.lighting', groups: ['backlight'] },
  { id: 'quantum', label: 'picker.cat.quantum', groups: ['quantum'] },
  { id: 'macro', label: 'picker.cat.macro', groups: ['macro'] },
  { id: 'tapDance', label: 'picker.cat.tapDance', groups: ['tapDance'] },
  { id: 'user', label: 'picker.cat.user', groups: ['user'] },
  { id: 'boot', label: 'picker.cat.boot', groups: ['boot'] },
];

const SEARCH_LIMIT = 120;

/** Type des données glissées depuis la grille (valeur numérique du keycode). */
export const KEYCODE_MIME = 'application/x-colagan-keycode';

/** Keycodes qui figent ou effacent le clavier : confirmation avant affectation. */
export const RISKY_KEYCODES: ReadonlySet<string> = new Set(['QK_BOOT', 'QK_CLEAR_EEPROM']);

export interface PickerOptions {
  readonly catalog: KeycodeCatalog;
  readonly layout: LabelLayout;
  readonly onPick: (code: number) => void;
}

const normalize = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export class KeycodePicker {
  readonly element: HTMLElement;
  private category: string = CATEGORIES[0]?.id ?? 'basic';
  private query = '';
  private pendingMask: KeycodeEntry | undefined;
  private enabled = false;
  private current: number | undefined;
  private readonly grid: HTMLElement;
  private readonly categoryBar: HTMLElement;
  private readonly maskBanner: HTMLElement;
  private readonly message: HTMLElement;
  private readonly search: HTMLInputElement;

  constructor(private readonly options: PickerOptions) {
    this.element = document.createElement('section');
    this.element.className = 'picker';
    this.element.setAttribute('aria-label', t('picker.label'));
    this.element.innerHTML = `
      <div class="picker__tools">
        <input type="search" class="picker__search" placeholder="${t('picker.search')}" aria-label="${t('picker.search')}">
        <form class="picker__advanced">
          <input type="text" name="expression" placeholder="${t('picker.advanced')}" aria-label="${t('picker.advanced')}" spellcheck="false" autocomplete="off">
          <button type="submit">${t('picker.apply')}</button>
        </form>
      </div>
      <p class="picker__mask" hidden></p>
      <div class="picker__categories" role="group" aria-label="${t('picker.categories')}"></div>
      <div class="picker__grid"></div>
      <p class="picker__message" role="status" aria-live="polite"></p>`;
    this.search = this.query$('.picker__search') as HTMLInputElement;
    this.grid = this.query$('.picker__grid');
    this.categoryBar = this.query$('.picker__categories');
    this.maskBanner = this.query$('.picker__mask');
    this.message = this.query$('.picker__message');

    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim();
      this.render();
    });
    const form = this.query$('.picker__advanced') as HTMLFormElement;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.elements.namedItem('expression') as HTMLInputElement;
      this.applyExpression(input.value);
    });
    this.render();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.element.classList.toggle('picker--disabled', !enabled);
    if (!enabled) this.pendingMask = undefined;
    this.render();
  }

  /** Keycode de la touche sélectionnée, mis en évidence dans la grille. */
  setCurrent(code: number | undefined): void {
    if (code === this.current) return;
    this.current = code;
    for (const button of this.grid.querySelectorAll<HTMLElement>('.keycode')) {
      button.classList.toggle('is-cur', code !== undefined && button.dataset.value === String(code));
    }
  }

  private query$(selector: string): HTMLElement {
    const el = this.element.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Élément ${selector} absent`);
    return el;
  }

  private say(text: string, level: 'info' | 'error' = 'info'): void {
    this.message.textContent = text;
    this.message.dataset.level = level;
  }

  private applyExpression(text: string): void {
    if (!this.enabled) {
      this.say(t('picker.selectFirst'), 'error');
      return;
    }
    try {
      const code = this.options.catalog.deserialize(text.trim());
      if (!Number.isInteger(code) || code < 0 || code > 0xffff) throw new RangeError(String(code));
      this.say('');
      this.options.onPick(code);
    } catch {
      this.say(t('picker.invalid', { text }), 'error');
    }
  }

  private pick(entry: KeycodeEntry): void {
    if (!this.enabled) {
      this.say(t('picker.selectFirst'), 'error');
      return;
    }
    if (this.pendingMask) {
      const code = this.pendingMask.value | (entry.value & 0xff);
      this.pendingMask = undefined;
      this.say('');
      this.render();
      this.options.onPick(code);
      return;
    }
    if (entry.masked) {
      this.pendingMask = entry;
      this.say('');
      this.render();
      return;
    }
    this.say('');
    this.options.onPick(entry.value);
  }

  private visibleEntries(): readonly KeycodeEntry[] {
    const { catalog } = this.options;
    if (this.pendingMask) {
      // touche interne d'un keycode masqué : uniquement les keycodes de base (8 bits)
      return catalog.entries.filter((e) => (e.group === 'basic' || e.group === 'special') && e.value < 0x100);
    }
    const searchable = new Set(CATEGORIES.flatMap((c) => c.groups));
    if (this.query) {
      const q = normalize(this.query);
      const exact = this.options.layout === 'azerty' && Array.from(this.query).length === 1;
      const seen = new Set<string>();
      return catalog.entries
        .filter((e) => searchable.has(e.group))
        .filter((e) => {
          if (seen.has(e.id)) return false;
          const chars = this.options.layout === 'azerty' ? azertySearchChars(e.value) : [];
          const match = exact
            ? // touche AZERTY connue : seuls ses caractères comptent (sinon « q » trouverait aussi KC_Q)
              chars.length
              ? chars.includes(this.query)
              : e.label.toLowerCase() === this.query.toLowerCase()
            : [e.id, ...(e.aliases ?? []), e.label, e.tooltip ?? '', ...chars].some((s) =>
                normalize(s).includes(q),
              );
          if (match) seen.add(e.id);
          return match;
        })
        .slice(0, SEARCH_LIMIT);
    }
    const category = CATEGORIES.find((c) => c.id === this.category) ?? CATEGORIES[0];
    return catalog.entries.filter((e) => category?.groups.includes(e.group));
  }

  private render(): void {
    const { catalog, layout } = this.options;

    this.maskBanner.hidden = !this.pendingMask;
    this.maskBanner.replaceChildren();
    if (this.pendingMask) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'secondary';
      cancel.textContent = t('picker.cancel');
      cancel.addEventListener('click', () => {
        this.pendingMask = undefined;
        this.render();
      });
      this.maskBanner.append(
        t('picker.maskHint', { name: this.pendingMask.label.replaceAll('\n', ' ') }),
        ' ',
        cancel,
      );
    }

    this.categoryBar.hidden = Boolean(this.query) || Boolean(this.pendingMask);
    this.categoryBar.replaceChildren(
      ...CATEGORIES.map((category) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'cat';
        tab.setAttribute('aria-pressed', String(category.id === this.category));
        tab.dataset.category = category.id;
        tab.textContent = t(category.label);
        tab.addEventListener('click', () => {
          this.category = category.id;
          this.render();
        });
        return tab;
      }),
    );

    const entries = this.visibleEntries();
    this.grid.replaceChildren(
      ...entries.map((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'keycode';
        if (RISKY_KEYCODES.has(entry.id)) button.classList.add('keycode--risky');
        button.dataset.keycode = entry.id;
        button.dataset.value = String(entry.value);
        if (entry.value === this.current && !entry.masked) button.classList.add('is-cur');
        const main = document.createElement('span');
        main.className = 'm';
        main.textContent = entry.masked
          ? entry.label.replaceAll('\n', ' ')
          : flatLabel(keyLabel(catalog, entry.value, layout)) || entry.id;
        const code = document.createElement('span');
        code.className = 'c';
        code.textContent = entry.id.replace(/^KC_/, '');
        // libellés longs (OSM LCtl, Vol+…) : deux lignes en plus petit plutôt que tronqués
        if (Array.from(main.textContent).length > 3) button.classList.add('is-long');
        button.append(main, code);
        button.title = entry.tooltip ? `${entry.id} : ${entry.tooltip}` : entry.id;
        if (!entry.masked && !this.pendingMask) {
          // glisser un keycode sur une touche du clavier l'y affecte
          button.draggable = true;
          button.addEventListener('dragstart', (event) => {
            event.dataTransfer?.setData(KEYCODE_MIME, String(entry.value));
            event.dataTransfer?.setData('text/plain', entry.id);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
          });
        }
        button.addEventListener('click', () => {
          this.pick(entry);
        });
        return button;
      }),
    );
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'picker__empty';
      empty.textContent = t('picker.noResult');
      this.grid.append(empty);
    }
  }
}
