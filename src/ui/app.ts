import { createDemoKeyboard } from '../demo/demo-keyboard';
import { detectHidSupport, type HidSupport } from '../env/support';
import { readLabelLayout, saveLabelLayout } from '../env/label-layout';
import { readKeyboardView, saveKeyboardView, type KeyboardViewPref } from '../env/keyboard-view-pref';
import { readLedDisplay, saveLedDisplay, type LedDisplay } from '../env/led-preview-pref';
import { applyTheme, readTheme, type ThemeChoice } from '../env/theme';
import { DynamicState } from '../editor/dynamic-state';
import { trappedLayers } from '../editor/layer-guard';
import {
  KeyEditor,
  type Change,
  type DynamicStore,
  type KeyChange,
  type LedStore,
} from '../editor/key-editor';
import { t, type MessageKey } from '../i18n';
import { KeycodeCatalog } from '../keycodes/catalog';
import { flatLabel, keyLabel, type LabelLayout } from '../keycodes/labels';
import { parseKle, type KeyGeometry } from '../keyboard/kle';
import { layerName, profileFor, type KeyboardProfile } from '../profiles';
import { KeyboardClient } from '../protocol/client';
import { LayerLighting } from '../rgb/layer-lighting';
import { LedPreview, type LedPaint, type LedPaints, type PreviewState } from '../rgb/led-preview';
import type { LayerColor } from '../protocol/led-stream';
import { RgbController } from '../rgb/rgb-controller';
import type { Transport } from '../protocol/packet';
import { HidTransport } from '../transport/hid-transport';
import { confirmDialog } from './confirm';
import { keyId, paintLeds, renderKeyboard, type KeyView } from './keyboard-view';
import type { Keyboard3D } from './keyboard-3d/keyboard-3d';
import { KeycodePicker, RISKY_KEYCODES } from './keycode-picker';
import { renderBackupPanel } from './backup-panel';
import { DynamicPanel } from './dynamic-panel';
import { renderRgbPanel } from './rgb-panel';
import { cssColor, renderColorPanel } from './color-panel';
import { unlockKeyboard } from './unlock-dialog';

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
  readonly editor: KeyEditor;
  readonly rgb: RgbController | undefined;
  /** Couleurs réelles des LED (commande firmware 0xC0), lues tant qu'un dessin est visible. */
  readonly preview: LedPreview;
  /** Couleurs et effet par couche : undefined = pas encore lus, null = non gérés par le firmware. */
  lighting: LayerLighting | null | undefined;
  lightingLoad: Promise<void> | undefined;
  /** Macros, tap-dance et combos : lus à la première ouverture de l'onglet « Macros & co ». */
  dynamic: DynamicState | undefined;
}

interface WorkspaceView {
  readonly tabs: HTMLElement;
  readonly frame: HTMLElement;
  readonly ledStatus: HTMLElement;
  /** Mode Couleurs : pinceau et effet de la couche (à la place du choix de keycode). */
  readonly colorBox: HTMLElement;
  readonly modeButtons: HTMLElement;
  readonly details: HTMLElement;
  readonly editStatus: HTMLElement;
  readonly undo: HTMLButtonElement;
  readonly redo: HTMLButtonElement;
  picker: KeycodePicker;
}

type Level = 'ok' | 'warn' | 'error' | 'info';

export class App {
  private session: Session | undefined;
  private layer = 0;
  private selected: { row: number; col: number } | undefined;
  private layout: LabelLayout = readLabelLayout();
  private view: WorkspaceView | undefined;
  private section: 'keys' | 'dynamic' | 'backup' = 'keys';
  private mode: 'keys' | 'colors' = 'keys';
  private brush: LayerColor = [255, 0, 0];
  /** Glisser en cours en mode Couleurs : LED peintes (aperçu local) et leurs valeurs d'avant. */
  private drag:
    { layer: number; after: Map<number, LayerColor>; before: Map<number, LayerColor> } | undefined;
  private livePaints: LedPaints = new Map();
  private keyboardLayer: number | undefined;
  private colorPanelKey = '';
  private dynamicPanel: DynamicPanel | undefined;
  private ledDisplay: LedDisplay = readLedDisplay();
  private ledState: { state: PreviewState; detail?: string } = { state: 'idle' };
  private keyboardView: KeyboardViewPref = readKeyboardView();
  /** Vue 3D (module chargé à la demande) ; abandonnée pour la session si WebGL manque. */
  private k3d: Keyboard3D | undefined;
  private k3dLoading = false;
  private k3dFailed = false;
  private readonly support = detectHidSupport(window);

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    applyTheme(readTheme());
    this.renderShell();
    document.addEventListener('keydown', (event) => {
      this.onShortcut(event);
    });
    if (this.support === 'ok') {
      navigator.hid.addEventListener('disconnect', (event) => {
        if (this.session?.device === event.device) {
          this.session.preview.stop();
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
          <div class="topbar__prefs">
          <label>${t('labels.label')}
            <select id="labels">
              <option value="azerty">${t('labels.azerty')}</option>
              <option value="qwerty">${t('labels.qwerty')}</option>
            </select>
          </label>
          <label>${t('theme.label')}
            <select id="theme">
              <option value="auto">${t('theme.auto')}</option>
              <option value="light">${t('theme.light')}</option>
              <option value="dark">${t('theme.dark')}</option>
            </select>
          </label>
          </div>
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
    const labelsSelect = this.element('#labels') as HTMLSelectElement;
    labelsSelect.value = this.layout;
    labelsSelect.addEventListener('change', () => {
      this.layout = labelsSelect.value === 'qwerty' ? 'qwerty' : 'azerty';
      saveLabelLayout(this.layout);
      this.renderWorkspace();
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
    this.session?.preview.stop();
    const preview = new LedPreview(transport, {
      onFrame: (paints) => {
        this.livePaints = paints;
        this.paintPreview();
      },
      // le clavier affiche la couche éditée : en mode Couleurs, ou quand le dessin montre la couche
      previewLayer: () =>
        this.section === 'keys' && (this.mode === 'colors' || this.ledDisplay === 'layer')
          ? this.layer
          : null,
      onInfo: (ledInfo) => {
        if (ledInfo.activeLayer !== this.keyboardLayer) {
          this.keyboardLayer = ledInfo.activeLayer;
          this.markActiveTab();
        }
      },
      onState: (state, detail) => {
        this.ledState = { state, ...(detail ? { detail } : {}) };
        this.showLedState();
      },
    });
    this.ledState = { state: 'idle' };
    this.livePaints = new Map();
    this.keyboardLayer = undefined;
    this.colorPanelKey = '';
    this.session = {
      client,
      catalog,
      keys,
      profile: profileFor(info.uid),
      demo,
      ...(device ? { device } : {}),
      editor: new KeyEditor(client, this.dynamicStore(), this.ledStore()),
      rgb: info.rgb
        ? new RgbController(transport, info.rgb.initialMode, {
            maxBrightness: info.rgb.info.maxBrightness,
            onError: (error) => {
              this.status(
                'error',
                t('rgb.error', { message: error instanceof Error ? error.message : String(error) }),
              );
            },
          })
        : undefined,
      preview,
      lighting: undefined,
      lightingLoad: undefined,
      dynamic: undefined,
    };
    this.dynamicPanel = undefined;
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

  /** Construit l'espace de travail d'une session (le panneau de keycodes garde sa recherche entre deux rendus). */
  private renderWorkspace(): void {
    const workspace = this.element('#workspace');
    const session = this.session;
    workspace.hidden = !session;
    workspace.replaceChildren();
    this.k3d?.dispose();
    this.k3d = undefined;
    this.view = undefined;
    if (!session) return;

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
    const history = document.createElement('div');
    history.className = 'history';
    const undo = this.button(t('edit.undo'), 'Ctrl+Z', () => void this.undo());
    undo.id = 'undo';
    const redo = this.button(t('edit.redo'), 'Ctrl+Maj+Z', () => void this.redo());
    redo.id = 'redo';
    history.append(undo, redo);

    const frame = document.createElement('div');
    frame.className = 'keyboard-frame';
    const details = document.createElement('p');
    details.className = 'key-details';
    details.id = 'key-details';
    const editStatus = document.createElement('p');
    editStatus.className = 'status edit-status';
    editStatus.id = 'edit-status';
    editStatus.setAttribute('role', 'status');
    editStatus.setAttribute('aria-live', 'polite');

    const picker = this.createPicker(session);
    const colorBox = document.createElement('div');
    colorBox.id = 'color-box';
    const modeButtons = this.modeSwitch();
    const ledBar = this.ledBar();
    const keysSection = document.createElement('div');
    keysSection.id = 'section-keys';
    const header = document.createElement('div');
    header.className = 'keys-header';
    header.append(modeButtons, this.viewSwitch(), ledBar.element);
    keysSection.append(tabs, header, frame, details, picker.element, colorBox);
    const dynamicSection = document.createElement('div');
    dynamicSection.id = 'section-dynamic';
    const backupSection = document.createElement('div');
    backupSection.id = 'section-backup';
    backupSection.append(
      renderBackupPanel({
        client: session.client,
        catalog: session.catalog,
        positions: new Set(session.keys.map((k) => keyId(k.row, k.col))),
        keyboardName: session.client.info.definition.name ?? 'clavier',
        ensureUnlocked: () => this.ensureUnlocked(),
        onImported: () => {
          session.editor.clear();
          // macros / tap-dance / combos relus à la prochaine ouverture de l'onglet
          session.dynamic = undefined;
          this.dynamicPanel = undefined;
          dynamicSection.replaceChildren();
          this.refresh();
        },
      }),
    );

    const nav = document.createElement('div');
    nav.className = 'tabs sections';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', t('view.label'));
    const showSection = (): void => {
      keysSection.hidden = this.section !== 'keys';
      backupSection.hidden = this.section !== 'backup';
      dynamicSection.hidden = this.section !== 'dynamic';
      this.updatePreview();
      if (this.section === 'dynamic' && !dynamicSection.hasChildNodes())
        void this.loadDynamic(dynamicSection);
      for (const tab of nav.children) {
        tab.setAttribute('aria-selected', String((tab as HTMLElement).dataset.section === this.section));
      }
    };
    for (const [id, label] of [
      ['keys', t('view.keys')],
      ['dynamic', t('view.dynamic')],
      ['backup', t('view.backup')],
    ] as const) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.dataset.section = id;
      tab.textContent = label;
      tab.addEventListener('click', () => {
        this.section = id;
        showSection();
      });
      nav.append(tab);
    }
    showSection();
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.append(nav, history);
    workspace.append(toolbar, editStatus, keysSection, dynamicSection, backupSection);
    this.view = {
      tabs,
      frame,
      ledStatus: ledBar.status,
      colorBox,
      modeButtons,
      details,
      editStatus,
      undo,
      redo,
      picker,
    };
    this.showLedState();
    this.refresh();
  }

  /** Boutons à choix unique (rôle radio) ; renvoie le conteneur. */
  private segmented<T extends string>(
    label: string,
    id: string,
    options: readonly (readonly [T, string, string?])[],
    current: T,
    onChange: (value: T) => void,
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'segmented';
    group.id = id;
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', label);
    const caption = document.createElement('span');
    caption.className = 'segmented__label';
    caption.textContent = label;
    group.append(caption);
    for (const [value, text, title] of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(value === current));
      button.dataset.value = value;
      button.textContent = text;
      if (title) button.title = title;
      button.addEventListener('click', () => {
        for (const other of group.querySelectorAll('button')) {
          other.setAttribute('aria-checked', String(other === button));
        }
        onChange(value);
      });
      group.append(button);
    }
    return group;
  }

  private modeSwitch(): HTMLElement {
    return this.segmented<'keys' | 'colors'>(
      t('mode.label'),
      'edit-mode',
      [
        ['keys', t('mode.keys')],
        ['colors', t('mode.colors')],
      ],
      this.mode,
      (mode) => {
        this.mode = mode;
        this.updatePreview();
        this.refresh();
      },
    );
  }

  private viewSwitch(): HTMLElement {
    return this.segmented<KeyboardViewPref>(
      t('kbview.label'),
      'keyboard-view',
      [
        ['3d', t('kbview.3d')],
        ['plan', t('kbview.plan')],
      ],
      this.keyboardView,
      (value) => {
        this.keyboardView = value;
        saveKeyboardView(value);
        this.refresh();
      },
    );
  }

  /** Charge la vue 3D (three.js dans un fichier séparé) puis redessine ; reste en plan si WebGL manque. */
  private load3d(session: Session): void {
    if (this.k3dLoading || this.k3dFailed) return;
    this.k3dLoading = true;
    import('./keyboard-3d/keyboard-3d')
      .then(({ Keyboard3D }) => {
        if (this.session !== session || this.keyboardView !== '3d' || this.k3d) return;
        if (!Keyboard3D.supported()) {
          this.k3dFailed = true;
          this.editStatus('info', t('kbview.unsupported'));
          return;
        }
        this.k3d = new Keyboard3D({
          keys: session.keys,
          model: session.profile?.model3d,
          text: { canvas: t('kbview.canvas'), product: t('kbview.product'), top: t('kbview.top') },
          onKeyClick: (row, col, event) => {
            this.activateKey(row, col, event);
          },
          onPaintStart: (row, col, event) => {
            if (!event.altKey) this.dragStart(row, col);
          },
          onPaintEnter: (row, col) => {
            this.dragAdd(row, col);
          },
          onPaintEnd: () => {
            this.dragEnd();
          },
        });
      })
      .catch((error: unknown) => {
        this.k3dFailed = true;
        this.editStatus(
          'error',
          t('kbview.error', { message: error instanceof Error ? error.message : String(error) }),
        );
      })
      .finally(() => {
        this.k3dLoading = false;
        if (this.session === session) this.refresh();
      });
  }

  /** Clic (ou Entrée) sur une touche, quelle que soit la vue : la choisir, ou la peindre en mode Couleurs. */
  private activateKey(row: number, col: number, event: MouseEvent | KeyboardEvent): void {
    if (this.mode === 'colors') {
      this.paintKey(row, col, event);
      return;
    }
    this.selected = { row, col };
    this.refresh();
    this.view?.frame.querySelector<SVGGElement>(`[data-key="${keyId(row, col)}"]`)?.focus();
  }

  /** Couleurs sur le dessin affiché (3D ou plan). */
  private showPaints(paints: LedPaints): void {
    const frame = this.view?.frame;
    if (!frame) return;
    if (this.k3d && frame.contains(this.k3d.element)) this.k3d.setPaints(paints);
    else paintLeds(frame, paints);
  }

  /** Choix de l'éclairage affiché sur le dessin, et état de l'aperçu. */
  private ledBar(): { element: HTMLElement; status: HTMLElement } {
    const element = document.createElement('div');
    element.className = 'led-preview';
    const display = this.segmented<LedDisplay>(
      t('led.display'),
      'led-display',
      [
        ['off', t('led.off')],
        ['layer', t('led.layer'), t('led.layerHint')],
        ['live', t('led.live'), t('led.liveHint')],
      ],
      this.ledDisplay,
      (value) => {
        this.ledDisplay = value;
        saveLedDisplay(value);
        this.updatePreview();
        this.showLedState();
        this.paintPreview();
      },
    );
    const status = document.createElement('p');
    status.className = 'status';
    status.id = 'led-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    element.append(display, status);
    return { element, status };
  }

  /** Lecture paresseuse des couleurs par couche (mode Couleurs ou affichage de la couche). */
  private ensureLighting(): void {
    const session = this.session;
    if (!session || session.lighting !== undefined || session.lightingLoad) return;
    session.lightingLoad = LayerLighting.load(session.client.transport)
      .then((lighting) => {
        session.lighting = lighting ?? null;
      })
      .catch((error: unknown) => {
        session.lighting = null;
        this.editStatus(
          'error',
          t('colors.loadError', { message: error instanceof Error ? error.message : String(error) }),
        );
      })
      .finally(() => {
        session.lightingLoad = undefined;
        if (this.session === session) this.refresh();
      });
  }

  private updatePreview(): void {
    const session = this.session;
    if (!session) return;
    const wantsLayer = this.mode === 'colors' || this.ledDisplay === 'layer';
    if (this.section === 'keys' && wantsLayer) this.ensureLighting();
    const run = this.section === 'keys' && (this.ledDisplay !== 'off' || this.mode === 'colors');
    if (run) session.preview.start();
    else if (session.preview.active) session.preview.stop();
  }

  /**
   * Couleur de chaque touche sur le dessin : couleurs enregistrées de la couche (exactes) quand on montre la
   * couche ; l'état réel du clavier pour les touches transparentes et en mode « Clavier en direct ».
   */
  private paintPreview(): void {
    const session = this.session;
    const view = this.view;
    if (!session || !view) return;
    const lighting = session.lighting;
    const showLayer = Boolean(lighting) && (this.mode === 'colors' || this.ledDisplay === 'layer');
    const showLive = this.ledDisplay !== 'off';
    if (!showLayer) {
      this.showPaints(showLive ? this.livePaints : new Map());
      return;
    }
    const paints = new Map<string, LedPaint>();
    for (const k of session.keys) {
      const id = keyId(k.row, k.col);
      const color = lighting?.color(this.layer, k.row, k.col);
      if (color === undefined) continue;
      if (color === null) {
        const live = showLive ? this.livePaints.get(id) : undefined;
        paints.set(id, live ?? { kind: 'effect' });
      } else if (color[0] || color[1] || color[2]) {
        paints.set(id, { kind: 'on', css: cssColor(color) });
      } else {
        paints.set(id, { kind: 'off' });
      }
    }
    this.showPaints(paints);
  }

  private markActiveTab(): void {
    const tabs = this.view?.tabs;
    if (!tabs) return;
    [...tabs.children].forEach((tab, layer) => {
      const active = layer === this.keyboardLayer;
      tab.classList.toggle('tab--keyboard', active);
      if (active) tab.setAttribute('title', t('led.activeTab'));
      else tab.removeAttribute('title');
    });
  }

  /** Écrit des LED d'une couche avec historique ; `before` = valeurs à rétablir par Annuler. */
  private async commitColors(
    layer: number,
    after: ReadonlyMap<number, LayerColor>,
    before: ReadonlyMap<number, LayerColor>,
  ): Promise<void> {
    const session = this.session;
    if (!session?.lighting || !after.size) return;
    try {
      const written = await session.editor.change({ kind: 'leds', layer, before, after });
      if (written) {
        this.editStatus(
          'ok',
          t('colors.written', { count: after.size, layer: layerName(session.profile, layer) }),
        );
      }
    } catch (error) {
      session.lighting.stage(layer, before);
      this.editStatus(
        'error',
        t('colors.error', { message: error instanceof Error ? error.message : String(error) }),
      );
    }
    this.refresh();
  }

  /** Clic (ou Entrée) en mode Couleurs : peint la touche, ou reprend sa couleur avec Alt. */
  private paintKey(row: number, col: number, event: MouseEvent | KeyboardEvent): void {
    const lighting = this.session?.lighting;
    if (!lighting) return;
    const led = lighting.led(row, col);
    if (led === undefined) return;
    if (event.altKey) {
      this.brush = lighting.colorOfLed(this.layer, led);
      this.colorPanelKey = '';
      this.editStatus('info', t('colors.picked', { position: keyId(row, col) }));
      this.refresh();
      return;
    }
    const after = new Map([[led, this.brush]]);
    const before = lighting.stage(this.layer, after);
    void this.commitColors(this.layer, after, before);
  }

  /** Glisser sur plusieurs touches : aperçu local, une seule écriture (et une entrée d'historique) au relâché. */
  private dragStart(row: number, col: number): void {
    if (!this.session?.lighting) return;
    this.drag = { layer: this.layer, after: new Map(), before: new Map() };
    this.dragAdd(row, col);
  }

  private dragAdd(row: number, col: number): void {
    const lighting = this.session?.lighting;
    const drag = this.drag;
    if (!lighting || !drag) return;
    const led = lighting.led(row, col);
    if (led === undefined || drag.after.has(led)) return;
    drag.after.set(led, this.brush);
    const previous = lighting.stage(drag.layer, new Map([[led, this.brush]])).get(led) ?? null;
    drag.before.set(led, previous);
    this.paintPreview();
  }

  private dragEnd(): void {
    const drag = this.drag;
    this.drag = undefined;
    if (!drag) return;
    // une seule touche : c'est le clic qui suit qui l'écrit (paintKey) ; on retire l'aperçu local
    if (drag.after.size <= 1) {
      this.session?.lighting?.stage(drag.layer, drag.before);
      return;
    }
    void this.commitColors(drag.layer, drag.after, drag.before);
  }

  private attachPaintDrag(svg: SVGSVGElement): void {
    const keyAt = (target: EventTarget | null): [number, number] | undefined => {
      const id = (target instanceof Element ? target.closest<SVGGElement>('[data-key]') : null)?.dataset.key;
      if (!id) return undefined;
      const [row = 0, col = 0] = id.split(',').map(Number);
      return [row, col];
    };
    svg.addEventListener('pointerdown', (event) => {
      const key = keyAt(event.target);
      if (event.button !== 0 || event.altKey || !key) return;
      this.dragStart(key[0], key[1]);
    });
    svg.addEventListener('pointerover', (event) => {
      const key = keyAt(event.target);
      if (this.drag && event.buttons & 1 && key) this.dragAdd(key[0], key[1]);
    });
    svg.addEventListener('pointerup', () => {
      this.dragEnd();
    });
    svg.addEventListener('pointerleave', (event) => {
      if (!(event.buttons & 1)) this.dragEnd();
    });
  }

  private showLedState(): void {
    const el = this.view?.ledStatus;
    if (!el) return;
    const { state, detail } = this.ledState;
    const messages: Record<PreviewState, [Level, string]> = {
      idle: ['info', this.ledDisplay === 'off' ? t('led.idle') : ''],
      running: ['ok', t('led.running')],
      partial: ['warn', t('led.partial')],
      busy: ['info', t('led.busy')],
      unsupported: ['info', t('led.unsupported')],
      error: ['error', t('led.error', { message: detail ?? '?' })],
    };
    const [level, message] = messages[state];
    el.dataset.level = level;
    el.textContent = message;
    el.hidden = message === '';
  }

  /** Écritures dynamiques de l'historique, déléguées à l'état chargé (refusées tant qu'il ne l'est pas). */
  private dynamicStore(): DynamicStore {
    const state = (): DynamicState => {
      const dynamic = this.session?.dynamic;
      if (!dynamic) throw new Error('macros / tap-dance / combos non chargés');
      return dynamic;
    };
    return {
      setTapDance: (index, entry) => state().setTapDance(index, entry),
      setCombo: (index, entry) => state().setCombo(index, entry),
      setMacros: (buffer) => state().setMacros(buffer),
    };
  }

  private ledStore(): LedStore {
    return {
      setLedColors: async (layer, colors) => {
        const lighting = this.session?.lighting;
        if (!lighting) throw new Error('couleurs par couche non chargées');
        await lighting.write(layer, colors);
      },
    };
  }

  private async loadDynamic(container: HTMLElement): Promise<void> {
    const session = this.session;
    if (!session) return;
    const loading = document.createElement('p');
    loading.className = 'status';
    loading.dataset.level = 'info';
    loading.textContent = t('dyn.loading');
    container.replaceChildren(loading);
    try {
      session.dynamic ??= await DynamicState.load(session.client, session.catalog, () =>
        this.ensureUnlocked(),
      );
      this.dynamicPanel = new DynamicPanel({
        catalog: session.catalog,
        layout: this.layout,
        state: session.dynamic,
        editor: session.editor,
        report: (level, message) => {
          this.editStatus(level, message);
        },
        onChanged: () => {
          this.refresh();
        },
      });
      container.replaceChildren(this.dynamicPanel.element);
    } catch (error) {
      loading.dataset.level = 'error';
      loading.textContent = t('dyn.loadError', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Déverrouillage Vial (macros, QK_BOOT) : touches désignées par leur étiquette sur la couche 0. */
  private ensureUnlocked(): Promise<boolean> {
    const session = this.session;
    if (!session) return Promise.resolve(false);
    const { client, catalog } = session;
    return unlockKeyboard(client.transport, (row, col) => {
      const label = flatLabel(keyLabel(catalog, client.getKey(0, row, col), this.layout));
      return `« ${label} » [${keyId(row, col)}]`;
    });
  }

  private rgbContent(session: Session): HTMLElement {
    const { rgb, client } = session;
    const supported = client.info.rgb?.supportedEffects;
    if (!rgb || !supported) {
      const note = document.createElement('p');
      note.className = 'status';
      note.dataset.level = 'info';
      note.textContent = t('rgb.unsupported');
      return note;
    }
    return renderRgbPanel({
      controller: rgb,
      supportedEffects: supported,
      ledmapLayers: [],
      onError: (message) => {
        this.status('error', message);
      },
    });
  }

  private createPicker(session: Session): KeycodePicker {
    return new KeycodePicker({
      catalog: session.catalog,
      layout: this.layout,
      onPick: (code) => void this.assign(code),
    });
  }

  private button(label: string, shortcut: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = label;
    button.title = `${label} (${shortcut})`;
    button.addEventListener('click', onClick);
    return button;
  }

  /** Met à jour onglets, dessin, détails et boutons à partir de l'état courant. */
  private refresh(): void {
    const session = this.session;
    const view = this.view;
    if (!session || !view) return;
    const { client, catalog, keys, profile, editor } = session;

    view.tabs.replaceChildren(
      ...Array.from({ length: client.info.layers }, (_, layer) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(layer === this.layer));
        tab.textContent = `${String(layer)} · ${layerName(profile, layer)}`;
        tab.addEventListener('click', () => {
          this.layer = layer;
          this.refresh();
        });
        return tab;
      }),
    );
    this.markActiveTab();
    for (const button of view.modeButtons.querySelectorAll('button')) {
      button.setAttribute('aria-checked', String(button.dataset.value === this.mode));
    }

    const views: KeyView[] = keys.map((geometry) => {
      const code = client.getKey(this.layer, geometry.row, geometry.col);
      return {
        geometry,
        label: keyLabel(catalog, code, this.layout),
        title: catalog.tooltip(code),
        kind: code === 0 ? 'none' : code === 1 ? 'transparent' : 'normal',
      };
    });
    const selected = this.selected ? keyId(this.selected.row, this.selected.col) : undefined;
    const use3d = this.keyboardView === '3d' && !this.k3dFailed;
    if (!use3d && this.k3d) {
      this.k3d.dispose();
      this.k3d = undefined;
    }
    if (use3d && this.k3d) {
      if (this.k3d.element.parentElement !== view.frame) view.frame.replaceChildren(this.k3d.element);
      this.k3d.setState({
        views,
        selected: this.mode === 'keys' ? selected : undefined,
        layer: this.layer,
        paintMode: this.mode === 'colors',
      });
    } else {
      // plan SVG : vue choisie, ou en attendant le chargement de la 3D
      const keyboard = renderKeyboard({
        keys: views,
        ...(selected && this.mode === 'keys' ? { selected } : {}),
        onSelect: (row, col, event) => {
          this.activateKey(row, col, event);
        },
      });
      if (this.mode === 'colors') {
        keyboard.classList.add('keyboard--paint');
        this.attachPaintDrag(keyboard);
      }
      view.frame.replaceChildren(keyboard);
      if (use3d) this.load3d(session);
    }
    this.paintPreview();
    this.renderColorBox(session, view);

    if (this.selected) {
      const code = client.getKey(this.layer, this.selected.row, this.selected.col);
      view.details.textContent = t('key.selected', {
        layer: layerName(profile, this.layer),
        position: keyId(this.selected.row, this.selected.col),
        name: catalog.tooltip(code),
      });
    } else {
      view.details.textContent = t('key.none');
    }
    view.undo.disabled = !editor.canUndo;
    view.redo.disabled = !editor.canRedo;
    view.picker.setEnabled(Boolean(this.selected));
    view.picker.element.hidden = this.mode === 'colors';
    view.details.hidden = this.mode === 'colors';
  }

  /** Panneau du mode Couleurs, reconstruit seulement quand la couche ou l'état de chargement change. */
  private renderColorBox(session: Session, view: WorkspaceView): void {
    view.colorBox.hidden = this.mode !== 'colors';
    if (this.mode !== 'colors') {
      this.colorPanelKey = '';
      return;
    }
    const state = session.lighting === undefined ? 'loading' : session.lighting ? 'ready' : 'none';
    const key = `${String(this.layer)}:${state}`;
    if (key === this.colorPanelKey) return;
    this.colorPanelKey = key;
    if (state === 'loading') {
      const loading = document.createElement('p');
      loading.className = 'status';
      loading.dataset.level = 'info';
      loading.textContent = t('colors.loading');
      view.colorBox.replaceChildren(loading);
      return;
    }
    const name = layerName(session.profile, this.layer);
    view.colorBox.replaceChildren(
      renderColorPanel({
        lighting: session.lighting ?? undefined,
        layer: this.layer,
        layerName: name,
        brush: this.brush,
        onBrush: (brush) => {
          this.brush = brush;
        },
        globalRgb: () => this.rgbContent(session),
        globalMode: () => ({
          ...(session.rgb?.mode ?? { effect: 0, speed: 0, hue: 0, saturation: 0, value: 0 }),
        }),
        supportedEffects: session.client.info.rgb?.supportedEffects ?? [],
        maxBrightness: session.client.info.rgb?.info.maxBrightness ?? 255,
        onReset: () => void this.resetColors(name),
        onError: (message) => {
          this.editStatus('error', message);
        },
      }),
    );
  }

  private async resetColors(name: string): Promise<void> {
    const lighting = this.session?.lighting;
    if (!lighting) return;
    const layer = this.layer;
    const ok = await confirmDialog(t('colors.resetTitle', { layer: name }), t('colors.resetBody'), {
      confirmLabel: t('colors.resetConfirm'),
    });
    if (!ok) return;
    try {
      await lighting.reset(layer);
      this.editStatus('ok', t('colors.resetDone', { layer: name }));
    } catch (error) {
      this.editStatus(
        'error',
        t('colors.error', { message: error instanceof Error ? error.message : String(error) }),
      );
    }
    this.colorPanelKey = '';
    this.refresh();
  }

  private editStatus(level: Level, message: string): void {
    if (!this.view) return;
    this.view.editStatus.dataset.level = level;
    this.view.editStatus.textContent = message;
  }

  private describe(change: Pick<KeyChange, 'layer' | 'row' | 'col'>, code: number): Record<string, string> {
    const session = this.session;
    return {
      layer: layerName(session?.profile, change.layer),
      position: keyId(change.row, change.col),
      name: session
        ? `${flatLabel(keyLabel(session.catalog, code, this.layout))} (${session.catalog.serialize(code)})`
        : '',
    };
  }

  private async assign(code: number): Promise<void> {
    const session = this.session;
    const target = this.selected;
    if (!session || !target) return;
    const { catalog, editor } = session;
    const name = catalog.serialize(code);
    if (RISKY_KEYCODES.has(name)) {
      const body = name === 'QK_BOOT' ? t('edit.confirmBoot') : t('edit.confirmClear');
      if (!(await confirmDialog(t('edit.confirmTitle', { name }), body))) return;
      // QK_BOOT n'est accepté par le firmware que déverrouillé (sinon il enregistre KC_NO)
      if (name === 'QK_BOOT' && !(await this.ensureUnlocked())) return;
    }
    const position = { layer: this.layer, row: target.row, col: target.col };
    const trapped = trappedLayers(
      {
        layers: session.client.info.layers,
        positions: session.keys.map((k) => [k.row, k.col] as const),
        getKey: (l, r, c) => session.client.getKey(l, r, c),
      },
      { ...position, code },
      new Set(session.profile?.exitKeycodes ?? []),
    );
    if (trapped.length) {
      const layers = trapped.map((l) => layerName(session.profile, l)).join(', ');
      const ok = await confirmDialog(t('guard.title'), t('guard.body', { layers }), {
        confirmLabel: t('guard.confirm'),
      });
      if (!ok) return;
    }
    try {
      const result = await editor.assign(position.layer, position.row, position.col, code);
      if (result.stored !== result.requested) {
        this.editStatus(
          'warn',
          name === 'QK_BOOT'
            ? t('edit.bootLocked')
            : t('edit.replaced', { requested: name, stored: catalog.serialize(result.stored) }),
        );
      } else {
        this.editStatus('ok', t('edit.written', this.describe(position, result.stored)));
      }
    } catch (error) {
      this.editStatus(
        'error',
        t('edit.error', { message: error instanceof Error ? error.message : String(error) }),
      );
    }
    this.refresh();
  }

  private async undo(): Promise<void> {
    await this.travel('undo');
  }

  private async redo(): Promise<void> {
    await this.travel('redo');
  }

  private async travel(direction: 'undo' | 'redo'): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      const change = await (direction === 'undo' ? session.editor.undo() : session.editor.redo());
      if (change?.kind === 'key') {
        // on affiche la couche concernée pour que l'effet soit visible
        this.layer = change.layer;
        this.selected = { row: change.row, col: change.col };
        const code = direction === 'undo' ? change.before : change.after;
        this.editStatus(
          'info',
          t(direction === 'undo' ? 'edit.undone' : 'edit.redone', this.describe(change, code)),
        );
      } else if (change?.kind === 'leds') {
        this.layer = change.layer;
        this.colorPanelKey = '';
        this.editStatus(
          'info',
          t(direction === 'undo' ? 'edit.undoneEntry' : 'edit.redoneEntry', {
            name: t('colors.entryName', { layer: layerName(session.profile, change.layer) }),
          }),
        );
      } else if (change) {
        this.editStatus(
          'info',
          t(direction === 'undo' ? 'edit.undoneEntry' : 'edit.redoneEntry', { name: this.entryName(change) }),
        );
      }
      this.dynamicPanel?.refresh();
    } catch (error) {
      this.editStatus(
        'error',
        t('edit.error', { message: error instanceof Error ? error.message : String(error) }),
      );
    }
    this.refresh();
  }

  private entryName(change: Exclude<Change, KeyChange | { kind: 'leds' }>): string {
    if (change.kind === 'tapDance') return `TD(${String(change.index)})`;
    if (change.kind === 'combo') return t('dyn.comboName', { n: change.index });
    return `M${String(change.index)}`;
  }

  private onShortcut(event: KeyboardEvent): void {
    if (!this.session || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      void this.undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      void this.redo();
    }
  }
}
