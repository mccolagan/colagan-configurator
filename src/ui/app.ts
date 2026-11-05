import { createDemoKeyboard } from '../demo/demo-keyboard';
import { detectHidSupport, type HidSupport } from '../env/support';
import { readLabelLayout, saveLabelLayout } from '../env/label-layout';
import { readLedPreview, saveLedPreview } from '../env/led-preview-pref';
import { applyTheme, readTheme, type ThemeChoice } from '../env/theme';
import { DynamicState } from '../editor/dynamic-state';
import { trappedLayers } from '../editor/layer-guard';
import { KeyEditor, type Change, type DynamicStore, type KeyChange } from '../editor/key-editor';
import { t, type MessageKey } from '../i18n';
import { KeycodeCatalog } from '../keycodes/catalog';
import { flatLabel, keyLabel, type LabelLayout } from '../keycodes/labels';
import { parseKle, type KeyGeometry } from '../keyboard/kle';
import { layerName, profileFor, type KeyboardProfile } from '../profiles';
import { KeyboardClient } from '../protocol/client';
import { LedPreview, type LedPaints, type PreviewState } from '../rgb/led-preview';
import { RgbController } from '../rgb/rgb-controller';
import type { Transport } from '../protocol/packet';
import { HidTransport } from '../transport/hid-transport';
import { confirmDialog } from './confirm';
import { keyId, paintLeds, renderKeyboard, type KeyView } from './keyboard-view';
import { KeycodePicker, RISKY_KEYCODES } from './keycode-picker';
import { renderBackupPanel } from './backup-panel';
import { DynamicPanel } from './dynamic-panel';
import { renderRgbPanel } from './rgb-panel';
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
  /** Macros, tap-dance et combos : lus à la première ouverture de l'onglet « Macros & co ». */
  dynamic: DynamicState | undefined;
}

interface WorkspaceView {
  readonly tabs: HTMLElement;
  readonly frame: HTMLElement;
  /** Dessin en lecture seule de l'onglet RGB, pour l'aperçu des effets. */
  readonly rgbFrame: HTMLElement;
  readonly ledStatus: HTMLElement;
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
  private section: 'keys' | 'rgb' | 'dynamic' | 'backup' = 'keys';
  private dynamicPanel: DynamicPanel | undefined;
  private ledEnabled = readLedPreview();
  private ledState: { state: PreviewState; detail?: string } = { state: 'idle' };
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
        this.paintPreview(paints);
      },
      onState: (state, detail) => {
        this.ledState = { state, ...(detail ? { detail } : {}) };
        this.showLedState();
      },
    });
    this.ledState = { state: 'idle' };
    this.session = {
      client,
      catalog,
      keys,
      profile: profileFor(info.uid),
      demo,
      ...(device ? { device } : {}),
      editor: new KeyEditor(client, this.dynamicStore()),
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
    const keysSection = document.createElement('div');
    keysSection.id = 'section-keys';
    keysSection.append(tabs, frame, details, picker.element);
    const dynamicSection = document.createElement('div');
    dynamicSection.id = 'section-dynamic';
    const rgbSection = document.createElement('div');
    rgbSection.id = 'section-rgb';
    const rgbFrame = document.createElement('div');
    rgbFrame.className = 'keyboard-frame';
    rgbFrame.id = 'rgb-keyboard';
    rgbFrame.setAttribute('aria-label', t('led.previewLabel'));
    rgbSection.append(this.rgbContent(session), rgbFrame);
    const ledBar = this.ledBar();
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
      rgbSection.hidden = this.section !== 'rgb';
      backupSection.hidden = this.section !== 'backup';
      dynamicSection.hidden = this.section !== 'dynamic';
      ledBar.element.hidden = this.section !== 'keys' && this.section !== 'rgb';
      this.updatePreview();
      if (this.section === 'dynamic' && !dynamicSection.hasChildNodes())
        void this.loadDynamic(dynamicSection);
      for (const tab of nav.children) {
        tab.setAttribute('aria-selected', String((tab as HTMLElement).dataset.section === this.section));
      }
    };
    for (const [id, label] of [
      ['keys', t('view.keys')],
      ['rgb', t('view.rgb')],
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
    workspace.append(
      toolbar,
      editStatus,
      ledBar.element,
      keysSection,
      rgbSection,
      dynamicSection,
      backupSection,
    );
    this.view = { tabs, frame, rgbFrame, ledStatus: ledBar.status, details, editStatus, undo, redo, picker };
    this.showLedState();
    this.refresh();
  }

  /** Case « Éclairage réel » et état de l'aperçu, communs aux onglets Touches et RGB. */
  private ledBar(): { element: HTMLElement; status: HTMLElement } {
    const element = document.createElement('div');
    element.className = 'led-preview';
    const label = document.createElement('label');
    label.title = t('led.hint');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'led-preview';
    toggle.checked = this.ledEnabled;
    toggle.addEventListener('change', () => {
      this.ledEnabled = toggle.checked;
      saveLedPreview(this.ledEnabled);
      this.updatePreview();
    });
    label.append(toggle, ` ${t('led.toggle')}`);
    const status = document.createElement('p');
    status.className = 'status';
    status.id = 'led-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    element.append(label, status);
    return { element, status };
  }

  private updatePreview(): void {
    const preview = this.session?.preview;
    if (!preview) return;
    const visible = this.section === 'keys' || this.section === 'rgb';
    if (this.ledEnabled && visible) preview.start();
    else if (preview.active) preview.stop();
  }

  private paintPreview(paints: LedPaints): void {
    if (!this.view) return;
    paintLeds(this.view.frame, paints);
    paintLeds(this.view.rgbFrame, paints);
  }

  private showLedState(): void {
    const el = this.view?.ledStatus;
    if (!el) return;
    const { state, detail } = this.ledState;
    const messages: Record<PreviewState, [Level, string]> = {
      idle: ['info', this.ledEnabled ? '' : t('led.idle')],
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
    const { rgb, client, profile } = session;
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
      ledmapLayers: (profile?.ledmapLayers ?? []).map((layer) => layerName(profile, layer)),
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
    view.rgbFrame.replaceChildren(renderKeyboard({ keys: views }));
    view.frame.replaceChildren(
      renderKeyboard({
        keys: views,
        ...(selected ? { selected } : {}),
        onSelect: (row, col) => {
          this.selected = { row, col };
          this.refresh();
          view.frame.querySelector<SVGGElement>(`[data-key="${keyId(row, col)}"]`)?.focus();
        },
      }),
    );
    this.paintPreview(session.preview.current);

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

  private entryName(change: Exclude<Change, KeyChange>): string {
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
