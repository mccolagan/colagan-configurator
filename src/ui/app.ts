import { createDemoKeyboard } from '../demo/demo-keyboard';
import { detectHidSupport, type HidSupport } from '../env/support';
import { applyTheme, readTheme, type ThemeChoice } from '../env/theme';
import { t, type MessageKey } from '../i18n';
import { KeycodeCatalog } from '../keycodes/catalog';
import { parseKle, type KeyGeometry } from '../keyboard/kle';
import { layerName, profileFor, type KeyboardProfile } from '../profiles';
import { KeyboardClient } from '../protocol/client';
import type { Transport } from '../protocol/packet';
import { HidTransport } from '../transport/hid-transport';
import { keyId, renderKeyboard, type KeyView } from './keyboard-view';

// Interface raw HID de VIA / Vial
const RAW_HID_FILTER: HIDDeviceFilter = { usagePage: 0xff60, usage: 0x61 };

const SUPPORT_MESSAGES: Record<HidSupport, { key: MessageKey; level: 'ok' | 'error' }> = {
  ok: { key: 'support.ok', level: 'ok' },
  'insecure-context': { key: 'support.insecure', level: 'error' },
  'no-webhid': { key: 'support.noWebhid', level: 'error' },
};

interface Session {
  readonly client: KeyboardClient;
  readonly catalog: KeycodeCatalog;
  readonly keys: readonly KeyGeometry[];
  readonly profile: KeyboardProfile | undefined;
  readonly demo: boolean;
  readonly device?: HIDDevice;
}

type Level = 'ok' | 'warn' | 'error' | 'info';

export class App {
  private session: Session | undefined;
  private layer = 0;
  private selected: { row: number; col: number } | undefined;
  private readonly support = detectHidSupport(window);

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    applyTheme(readTheme());
    this.renderShell();
    if (this.support === 'ok') {
      navigator.hid.addEventListener('disconnect', (event) => {
        if (this.session?.device === event.device) {
          this.session = undefined;
          this.renderWorkspace();
          this.status('warn', t('connect.disconnected'));
        }
      });
      void this.reconnect();
    }
  }

  private element(selector: string): HTMLElement {
    const el = this.root.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Élément ${selector} absent`);
    return el;
  }

  private status(level: Level, message: string): void {
    const el = this.element('#connection');
    el.dataset.level = level;
    el.textContent = message;
  }

  private renderShell(): void {
    const support = SUPPORT_MESSAGES[this.support];
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div>
            <h1>${t('app.title')}</h1>
            <p>${t('app.subtitle')}</p>
          </div>
          <label>${t('theme.label')}
            <select id="theme">
              <option value="auto">${t('theme.auto')}</option>
              <option value="light">${t('theme.light')}</option>
              <option value="dark">${t('theme.dark')}</option>
            </select>
          </label>
        </header>
        <section class="panel">
          <p class="status" id="support" data-level="${support.level}">${t(support.key)}</p>
          <div class="actions">
            <button id="connect" type="button" ${this.support === 'ok' ? '' : 'disabled'}>${t('connect.button')}</button>
            <button id="demo" type="button" class="secondary">${t('demo.button')}</button>
          </div>
          <p class="status" id="connection" role="status" aria-live="polite"></p>
        </section>
        <section id="workspace" class="panel" hidden></section>
      </div>`;

    const themeSelect = this.element('#theme') as HTMLSelectElement;
    themeSelect.value = readTheme();
    themeSelect.addEventListener('change', () => {
      applyTheme(themeSelect.value as ThemeChoice);
    });
    this.element('#connect').addEventListener('click', () => void this.connect());
    this.element('#demo').addEventListener('click', () => void this.startDemo());
  }

  /** Clavier déjà autorisé lors d'une visite précédente : reconnexion sans clic. */
  private async reconnect(): Promise<void> {
    const devices = await navigator.hid.getDevices();
    const device = devices.find((d) =>
      d.collections.some((c) => c.usagePage === RAW_HID_FILTER.usagePage && c.usage === RAW_HID_FILTER.usage),
    );
    if (device) await this.openDevice(device);
  }

  private async connect(): Promise<void> {
    try {
      const [device] = await navigator.hid.requestDevice({ filters: [RAW_HID_FILTER] });
      if (!device) {
        // annulation : la session en cours (démo ou clavier) reste affichée avec son statut
        if (!this.session) this.status('warn', t('connect.none'));
        return;
      }
      await this.openDevice(device);
    } catch (error) {
      this.fail(error);
    }
  }

  private async openDevice(device: HIDDevice): Promise<void> {
    try {
      const transport = await HidTransport.open(device);
      await this.attach(transport, false, device);
    } catch (error) {
      this.fail(error);
    }
  }

  private async startDemo(): Promise<void> {
    try {
      await this.attach(await createDemoKeyboard(), true);
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.status('error', `${t('connect.error', { message })} ${t('connect.linuxHint')}`);
  }

  private async attach(transport: Transport, demo: boolean, device?: HIDDevice): Promise<void> {
    this.status('info', t('connect.loading'));
    const client = await KeyboardClient.connect(transport);
    const { info } = client;
    const catalog = new KeycodeCatalog({
      layers: info.layers,
      macroCount: info.macroCount,
      tapDanceCount: info.dynamic.tapDance,
      customKeycodes: info.definition.customKeycodes ?? [],
    });
    const keys = parseKle(info.definition.layouts.keymap);
    this.session = {
      client,
      catalog,
      keys,
      profile: profileFor(info.uid),
      demo,
      ...(device ? { device } : {}),
    };
    this.layer = 0;
    this.selected = undefined;
    this.status(
      'ok',
      t('connect.ready', {
        name: info.definition.name ?? device?.productName ?? '?',
        layers: info.layers,
        keys: keys.length,
      }),
    );
    this.renderWorkspace();
  }

  private renderWorkspace(): void {
    const workspace = this.element('#workspace');
    const session = this.session;
    workspace.hidden = !session;
    workspace.replaceChildren();
    if (!session) return;
    const { client, catalog, keys, profile } = session;

    if (session.demo) {
      const banner = document.createElement('p');
      banner.className = 'banner';
      banner.textContent = t('demo.banner');
      workspace.append(banner);
    }

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', t('layers.label'));
    for (let layer = 0; layer < client.info.layers; layer++) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(layer === this.layer));
      tab.textContent = `${String(layer)} · ${layerName(profile, layer)}`;
      tab.addEventListener('click', () => {
        this.layer = layer;
        this.renderWorkspace();
      });
      tabs.append(tab);
    }

    const views: KeyView[] = keys.map((geometry) => {
      const code = client.getKey(this.layer, geometry.row, geometry.col);
      return {
        geometry,
        label: catalog.label(code),
        title: catalog.tooltip(code),
        kind: code === 0 ? 'none' : code === 1 ? 'transparent' : 'normal',
      };
    });
    const selected = this.selected ? keyId(this.selected.row, this.selected.col) : undefined;
    const drawing = renderKeyboard({
      keys: views,
      ...(selected ? { selected } : {}),
      onSelect: (row, col) => {
        this.selected = { row, col };
        this.renderWorkspace();
        this.root.querySelector<SVGGElement>(`[data-key="${keyId(row, col)}"]`)?.focus();
      },
    });
    const frame = document.createElement('div');
    frame.className = 'keyboard-frame';
    frame.append(drawing);

    const details = document.createElement('p');
    details.className = 'key-details';
    details.id = 'key-details';
    if (this.selected) {
      const code = client.getKey(this.layer, this.selected.row, this.selected.col);
      details.textContent = t('key.selected', {
        layer: layerName(profile, this.layer),
        position: keyId(this.selected.row, this.selected.col),
        name: catalog.tooltip(code),
      });
    } else {
      details.textContent = t('key.none');
    }

    workspace.append(tabs, frame, details);
  }
}
