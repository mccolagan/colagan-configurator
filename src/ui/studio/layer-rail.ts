// Barre des couches (en bas de l'écran) : pastille de teinte, nom et numéro, curseur comme les contrôles
// segmentés ; une fiche au survol (ou au focus, ou au toucher) donne la description, l'accès et la mini-carte.
import { t } from '../../i18n';
import type { KeyGeometry } from '../../keyboard/kle';
import type { KeyKind } from '../keyboard-view';
import { h } from './dom';

export interface RailLayer {
  readonly name: string;
  readonly description: string;
  readonly tint: string;
}

export interface MiniKey {
  readonly geometry: KeyGeometry;
  readonly kind: KeyKind;
  /** Couleur de la LED sur cette couche (CSS), si elle en a une. */
  readonly color?: string;
}

interface Item {
  readonly button: HTMLButtonElement;
  readonly layer: RailLayer;
}

/** Délai avant la première fiche au survol ; les suivantes s'enchaînent sans attente. */
const HOVER_DELAY_MS = 220;
const HIDE_DELAY_MS = 160;
/** Fiche montrée après un toucher (pas de survol sur écran tactile). */
const TOUCH_CARD_MS = 1800;

export class LayerRail {
  readonly element: HTMLElement;
  /** Fiche de couche, à placer dans le même conteneur que la barre. */
  readonly card: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly cardDot: HTMLElement;
  private readonly cardName: HTMLElement;
  private readonly cardNum: HTMLElement;
  private readonly cardDesc: HTMLElement;
  private readonly cardAccess: HTMLElement;
  private readonly cardLive: HTMLElement;
  private readonly cardMap: HTMLCanvasElement;
  private items: Item[] = [];
  private minis: (readonly MiniKey[])[] = [];
  /** Comment atteindre chaque couche depuis le clavier (« MO · BASE »…), relu avec la keymap. */
  private accesses: string[] = [];
  private current = 0;
  private keyboardLayer: number | undefined;
  private cardLayer: number | undefined;
  private cardTimer: number | undefined;

  constructor(private readonly onSelect: (layer: number) => void) {
    this.thumb = h('span', { class: 'thumb', 'aria-hidden': 'true' });
    this.element = h(
      'nav',
      { class: 'seg glass dock', id: 'rail', role: 'tablist', 'aria-label': t('layers.label') },
      this.thumb,
    );
    this.element.addEventListener(
      'scroll',
      () => {
        if (this.cardLayer !== undefined) this.placeCard(this.cardLayer);
      },
      { passive: true },
    );
    this.cardDot = h('span', { class: 'ldot' });
    this.cardName = h('span');
    this.cardNum = h('span', { class: 'lnum' });
    this.cardDesc = h('div', { class: 'lc-d' });
    this.cardAccess = h('div', { class: 'lc-a' });
    this.cardLive = h('div', { class: 'lc-live', hidden: true }, h('i'), t('layers.live'));
    this.cardMap = h('canvas', { width: 384, height: 120 });
    this.card = h(
      'div',
      { class: 'lcard glass out', 'aria-hidden': 'true' },
      h('div', { class: 'lc-h' }, this.cardDot, this.cardName, this.cardNum),
      this.cardDesc,
      this.cardMap,
      this.cardAccess,
      this.cardLive,
    );
  }

  setLayers(layers: readonly RailLayer[]): void {
    this.hideCard();
    this.items = layers.map((layer, n) => {
      const button = h(
        'button',
        {
          type: 'button',
          class: 'layer',
          role: 'tab',
          'aria-label': `${String(n)} · ${layer.name}`,
          'data-layer': n,
        },
        h('span', { class: 'ldot' }),
        h('span', { class: 'lname', text: layer.name }),
        h('span', { class: 'lnum', text: String(n) }),
      );
      button.style.setProperty('--tint', layer.tint);
      let touch = false;
      button.addEventListener('pointerdown', (event) => {
        touch = event.pointerType === 'touch';
      });
      button.addEventListener('click', () => {
        this.onSelect(n);
        if (touch) this.showCard(n, TOUCH_CARD_MS);
      });
      button.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        window.clearTimeout(this.cardTimer);
        if (this.cardLayer !== undefined) this.showCard(n);
        else
          this.cardTimer = window.setTimeout(() => {
            this.showCard(n);
          }, HOVER_DELAY_MS);
      });
      button.addEventListener('pointerleave', () => {
        this.hideCardSoon();
      });
      button.addEventListener('focus', () => {
        if (button.matches(':focus-visible')) this.showCard(n);
      });
      button.addEventListener('blur', () => {
        this.hideCardSoon();
      });
      return { button, layer };
    });
    this.minis = [];
    this.accesses = [];
    this.element.replaceChildren(this.thumb, ...this.items.map((i) => i.button));
  }

  /** Couche affichée et couche active sur le clavier (anneau à onde lente sur sa pastille). */
  update(current: number, keyboardLayer: number | undefined): void {
    this.current = current;
    this.keyboardLayer = keyboardLayer;
    this.items.forEach((item, n) => {
      item.button.setAttribute('aria-selected', String(n === current));
      item.button.classList.toggle('tab--keyboard', n === keyboardLayer);
    });
    this.sync();
    const on = this.items[current]?.button;
    const dock = this.element;
    if (on && dock.scrollWidth > dock.clientWidth)
      dock.scrollTo({ left: on.offsetLeft - (dock.clientWidth - on.offsetWidth) / 2 });
    if (this.cardLayer !== undefined) this.fillCard(this.cardLayer);
  }

  /** Mode compact si la barre déborde, puis curseur et fiche recalés (après un redimensionnement). */
  sync(): void {
    const dock = this.element;
    dock.classList.remove('compact');
    dock.classList.toggle('compact', dock.scrollWidth > dock.clientWidth + 1);
    const on = this.items[this.current]?.button;
    if (!on?.offsetWidth) {
      this.thumb.style.width = '0';
    } else {
      this.thumb.style.width = `${String(on.offsetWidth)}px`;
      this.thumb.style.transform = `translateX(${String(on.offsetLeft - 3)}px)`;
    }
    if (this.cardLayer !== undefined) this.placeCard(this.cardLayer);
  }

  setAccess(layer: number, access: string): void {
    if (this.accesses[layer] === access) return;
    this.accesses[layer] = access;
    if (this.cardLayer === layer) this.fillCard(layer);
  }

  drawMini(layer: number, keys: readonly MiniKey[]): void {
    this.minis[layer] = keys;
    if (this.cardLayer === layer) this.drawMap(layer);
  }

  private showCard(layer: number, ms = 0): void {
    window.clearTimeout(this.cardTimer);
    this.card.classList.toggle('glide', !this.card.classList.contains('out'));
    this.cardLayer = layer;
    this.fillCard(layer);
    this.placeCard(layer);
    this.card.classList.remove('out');
    if (ms)
      this.cardTimer = window.setTimeout(() => {
        this.hideCard();
      }, ms);
  }

  private hideCard(): void {
    window.clearTimeout(this.cardTimer);
    this.cardLayer = undefined;
    this.card.classList.add('out');
  }

  private hideCardSoon(): void {
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => {
      this.hideCard();
    }, HIDE_DELAY_MS);
  }

  private fillCard(layer: number): void {
    const item = this.items[layer];
    if (!item) return;
    const live = layer === this.keyboardLayer;
    this.card.style.setProperty('--tint', item.layer.tint);
    this.card.classList.toggle('is-live', live);
    this.cardName.textContent = item.layer.name;
    this.cardNum.textContent = t('layers.number', { n: layer });
    this.cardDesc.textContent = item.layer.description;
    this.cardDesc.hidden = !item.layer.description;
    const access = this.accesses[layer] ?? '';
    this.cardAccess.textContent = access ? t('layers.access', { access }) : '';
    this.cardAccess.hidden = !access;
    this.cardLive.hidden = !live;
    this.drawMap(layer);
  }

  /** Fiche centrée au-dessus de sa couche, sans sortir de la zone libre (l'inspecteur reste dégagé). */
  private placeCard(layer: number): void {
    const button = this.items[layer]?.button;
    const host = this.card.parentElement;
    if (!button || !host) return;
    const box = host.getBoundingClientRect();
    const r = button.getBoundingClientRect();
    const w = this.card.offsetWidth || 248;
    const inspector = parseFloat(getComputedStyle(host).getPropertyValue('--insp')) || 0;
    const right = innerWidth <= 820 ? box.width : box.width - inspector - 8;
    const x = Math.min(Math.max(r.left + r.width / 2 - box.left, w / 2), Math.max(w / 2, right - w / 2));
    this.card.style.left = `${String(Math.round(x))}px`;
  }

  private drawMap(layer: number): void {
    const keys = this.minis[layer];
    const canvas = this.cardMap;
    const g = canvas.getContext('2d');
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    if (!keys?.length) return;
    const style = getComputedStyle(document.documentElement);
    const faint = style.getPropertyValue('--faint').trim() || '#aeaeb2';
    const line = style.getPropertyValue('--line-2').trim() || 'rgba(0,0,0,.14)';
    const k0 = W / 192;
    const minX = Math.min(...keys.map((k) => k.geometry.x));
    const minY = Math.min(...keys.map((k) => k.geometry.y));
    const maxX = Math.max(...keys.map((k) => k.geometry.x + k.geometry.w));
    const maxY = Math.max(...keys.map((k) => k.geometry.y + k.geometry.h));
    const scale = Math.min((W - 8 * k0) / (maxX - minX + 0.6), (H - 6 * k0) / (maxY - minY + 0.6));
    const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
    for (const key of keys) {
      const k = key.geometry;
      g.save();
      g.translate(ox + k.rx * scale, oy + k.ry * scale);
      g.rotate((k.r * Math.PI) / 180);
      const x = (k.x - k.rx) * scale;
      const y = (k.y - k.ry) * scale;
      const w = k.w * scale;
      const hh = k.h * scale;
      g.beginPath();
      g.roundRect(x + w * 0.08, y + hh * 0.08, w * 0.84, hh * 0.84, 2.5 * k0);
      if (key.kind === 'transparent') {
        g.strokeStyle = line;
        g.lineWidth = k0;
        g.stroke();
      } else if (key.kind === 'none') {
        g.fillStyle = line;
        g.fill();
      } else {
        g.fillStyle = key.color ?? faint;
        g.fill();
      }
      g.restore();
    }
  }
}
