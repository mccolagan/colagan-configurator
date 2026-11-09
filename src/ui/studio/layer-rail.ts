// Rail des couches (à gauche) : pastille de teinte, nom, numéro, description et mini-carte de la couche choisie.
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
  readonly desc: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly base: string;
}

export class LayerRail {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private items: Item[] = [];

  constructor(private readonly onSelect: (layer: number) => void) {
    this.list = h('div', {
      class: 'rail-list',
      role: 'tablist',
      'aria-label': t('layers.label'),
      'aria-orientation': 'vertical',
    });
    this.element = h(
      'nav',
      { class: 'rail glass', id: 'rail', 'aria-label': t('layers.label') },
      h('div', { class: 'rail-h', text: t('layers.label') }),
      this.list,
    );
  }

  setLayers(layers: readonly RailLayer[]): void {
    this.items = layers.map((layer, n) => {
      const desc = h('span', { class: 'ldesc', text: layer.description });
      const canvas = h('canvas', { width: 192, height: 60, 'aria-hidden': 'true' });
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
        desc,
        canvas,
      );
      button.style.setProperty('--tint', layer.tint);
      button.addEventListener('click', () => {
        this.onSelect(n);
      });
      return { button, desc, canvas, base: layer.description };
    });
    this.list.replaceChildren(...this.items.map((i) => i.button));
  }

  /** Couche affichée et couche active sur le clavier (signalée par un anneau et dans la description). */
  update(current: number, keyboardLayer: number | undefined): void {
    this.items.forEach((item, n) => {
      item.button.setAttribute('aria-selected', String(n === current));
      const active = n === keyboardLayer;
      item.button.classList.toggle('tab--keyboard', active);
      item.button.title = active ? t('led.activeTab') : '';
      item.desc.replaceChildren(item.base);
      if (active)
        item.desc.append(item.base ? ' · ' : '', h('span', { class: 'lnow', text: t('layers.onKeyboard') }));
    });
  }

  drawMini(layer: number, keys: readonly MiniKey[]): void {
    const canvas = this.items[layer]?.canvas;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || !keys.length) return;
    const style = getComputedStyle(document.documentElement);
    const faint = style.getPropertyValue('--faint').trim() || '#aeaeb2';
    const line = style.getPropertyValue('--line-2').trim() || 'rgba(0,0,0,.14)';
    const minX = Math.min(...keys.map((k) => k.geometry.x));
    const minY = Math.min(...keys.map((k) => k.geometry.y));
    const maxX = Math.max(...keys.map((k) => k.geometry.x + k.geometry.w));
    const maxY = Math.max(...keys.map((k) => k.geometry.y + k.geometry.h));
    const W = canvas.width;
    const H = canvas.height;
    const scale = Math.min((W - 8) / (maxX - minX + 0.6), (H - 6) / (maxY - minY + 0.6));
    const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
    g.clearRect(0, 0, W, H);
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
      g.roundRect(x + w * 0.08, y + hh * 0.08, w * 0.84, hh * 0.84, 2.5);
      if (key.kind === 'transparent') {
        g.strokeStyle = line;
        g.lineWidth = 1;
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
