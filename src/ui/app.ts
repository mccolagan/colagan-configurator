import { createDemoKeyboard } from '../demo/demo-keyboard';
import { FakeKeyboard } from '../protocol/fake-keyboard';
import { KeyCapture } from '../editor/key-capture';
import { detectHidSupport, type HidSupport } from '../env/support';
import { readLabelLayout, saveLabelLayout } from '../env/label-layout';
import { readKeyboardView, saveKeyboardView, type KeyboardViewPref } from '../env/keyboard-view-pref';
import { readLedDisplay, saveLedDisplay, type LedDisplay } from '../env/led-preview-pref';
import { applyTheme, readTheme } from '../env/theme';
import { DynamicState } from '../editor/dynamic-state';
import { FirmwareSim } from '../editor/firmware-sim';
import { hidUsages, sendsUsage } from '../editor/hid-usage';
import { layerAccesses, resolveKey, type KeymapView } from '../editor/layer-access';
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
import { flatLabel, keyLabel, type KeyLabel, type LabelLayout } from '../keycodes/labels';
import { parseKle, type KeyGeometry } from '../keyboard/kle';
import { layerName, profileFor, type KeyboardProfile } from '../profiles';
import { layerDescription, layerTint, tripleTap } from '../profiles/layer-style';
import { KeyboardClient } from '../protocol/client';
import { LayerLighting } from '../rgb/layer-lighting';
import { LedPreview, type LedPaint, type LedPaints, type PreviewState } from '../rgb/led-preview';
import type { LayerColor, LedStreamInfo } from '../protocol/led-stream';
import { RgbController } from '../rgb/rgb-controller';
import type { Transport } from '../protocol/packet';
import { HidTransport } from '../transport/hid-transport';
import { confirmDialog } from './confirm';
import { keyId, paintLeds, renderKeyboard, type KeyView } from './keyboard-view';
import type {
  Keyboard3D,
  SceneHit,
  SceneMode,
  SceneView,
  SplitLink,
  StackLayer,
} from './keyboard-3d/keyboard-3d';
import { KEYCODE_MIME, KeycodePicker, RISKY_KEYCODES } from './keycode-picker';
import { renderBackupPanel } from './backup-panel';
import { DynamicPanel } from './dynamic-panel';
import { cssColor, renderColorPanel } from './color-panel';
import { unlockKeyboard } from './unlock-dialog';
import { DisplayPop, DEFAULT_SPLIT, type Split } from './studio/display-pop';
import { brandMark, errorMessage, h, icon } from './studio/dom';
import { EffectPreviews, previewKeys } from './studio/effect-preview';
import { Guide, guideTopics } from './studio/guide';
import { LayerRail, type MiniKey } from './studio/layer-rail';
import { CommandPalette, type Command } from './studio/palette';
import { Seg } from './studio/seg';
import { Toasts, type ToastAction } from './studio/toasts';
import { effectName } from './rgb-panel';

// Interface raw HID de VIA / Vial
const RAW_HID_FILTER: HIDDeviceFilter = { usagePage: 0xff60, usage: 0x61 };

const SUPPORT_MESSAGES: Record<HidSupport, { key: MessageKey; level: 'ok' | 'error' }> = {
  ok: { key: 'support.ok', level: 'ok' },
  'insecure-context': { key: 'support.insecure', level: 'error' },
  'no-webhid': { key: 'support.noWebhid', level: 'error' },
};

type InspectorTab = 'keys' | 'light' | 'dynamic' | 'try';
type ViewChoice = SceneView | 'plan';
type Level = 'ok' | 'warn' | 'error' | 'info';

const VIEWS: readonly (readonly [ViewChoice, MessageKey])[] = [
  ['product', 'kbview.product'],
  ['top', 'kbview.top'],
  ['exploded', 'kbview.exploded'],
  ['xray', 'kbview.xray'],
  ['stack', 'kbview.stack'],
  ['plan', 'kbview.plan'],
];

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Relecture de l'état du split quand l'aperçu LED est arrêté (ms). */
const LINK_POLL_MS = 2000;

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
  /** Keymap vue par les gardes, l'onglet Essai et la recherche des touches frappées. */
  readonly keymap: KeymapView;
  readonly sim: FirmwareSim;
  /** Couleurs et effet par couche : undefined = pas encore lus, null = non gérés par le firmware. */
  lighting: LayerLighting | null | undefined;
  lightingLoad: Promise<void> | undefined;
  /** Macros, tap-dance et combos : lus à la première ouverture de l'onglet « Macros & co ». */
  dynamic: DynamicState | undefined;
}

interface Workspace {
  readonly picker: KeycodePicker;
  readonly keyHead: HTMLElement;
  readonly colorBox: HTMLElement;
  readonly dynamicBox: HTMLElement;
  readonly tryBox: HTMLElement;
  readonly previews: EffectPreviews;
}

interface OutputItem {
  readonly ch?: string;
  readonly tok?: string;
}

/** Usages HID qui produisent un caractère (lettres, chiffres, ponctuation, touche ISO). */
const PRINTABLE = (usage: number): boolean =>
  (usage >= 0x04 && usage <= 0x27) || (usage >= 0x2d && usage <= 0x38) || usage === 0x64;

export class App {
  private session: Session | undefined;
  private ws: Workspace | undefined;
  private layer = 0;
  private selected: { row: number; col: number } | undefined;
  private layout: LabelLayout = readLabelLayout();
  private tab: InspectorTab = 'keys';
  private brush: LayerColor = [255, 0, 0];
  /** Glisser en cours dans l'onglet Lumière : LED peintes (aperçu local) et leurs valeurs d'avant. */
  private drag:
    { layer: number; after: Map<number, LayerColor>; before: Map<number, LayerColor> } | undefined;
  private livePaints: LedPaints = new Map();
  private keyboardLayer: number | undefined;
  /** Moitié branchée au PC et lien avec l'autre, lus dans la réponse info de la commande 0xC0. */
  private link: SplitLink | undefined;
  /** Capture armée : la prochaine touche tapée sur le clavier de l'ordinateur est affectée à la touche choisie. */
  private capturing = false;
  private readonly keyCapture = new KeyCapture();
  private linkTimer: number | undefined;
  private deviceHalves: HTMLElement | undefined;
  private ui!: HTMLElement;
  private colorPanelKey = '';
  private dynamicPanel: DynamicPanel | undefined;
  private ledDisplay: LedDisplay = readLedDisplay();
  private ledState: { state: PreviewState; detail?: string } = { state: 'idle' };
  private keyboardView: KeyboardViewPref = readKeyboardView();
  private sceneView: SceneView = 'product';
  private readonly split: Split = { ...DEFAULT_SPLIT };
  private caseOn = true;
  /** Dernier effet allumé, rétabli par l'interrupteur « Éclairage allumé ». */
  private lastEffect = 0;
  /** Vue 3D (module chargé à la demande) ; abandonnée pour la session si WebGL manque. */
  private k3d: Keyboard3D | undefined;
  private k3dLoading = false;
  private k3dFailed = false;
  private planKeys: SVGSVGElement | undefined;
  private tryOutput: OutputItem[] = [];
  private readonly physical = new Map<string, { row: number; col: number }>();
  private siriTimer = 0;
  private tickerTimer = 0;
  private readonly support = detectHidSupport(window);

  // coque, construite une fois
  private stage!: HTMLElement;
  private planFrame!: HTMLElement;
  private views!: Seg<ViewChoice>;
  private rail!: LayerRail;
  private guide!: Guide;
  private inspector!: HTMLElement;
  private tabs!: Seg<InspectorTab>;
  private panels!: Record<InspectorTab, HTMLElement>;
  private undoButton!: HTMLButtonElement;
  private redoButton!: HTMLButtonElement;
  private pill!: HTMLButtonElement;
  private display!: DisplayPop;
  private displayButton!: HTMLButtonElement;
  private welcome!: HTMLElement;
  private device!: HTMLElement;
  private ticker!: HTMLElement;
  private siri!: HTMLElement;
  private tip!: HTMLElement;
  private loader!: HTMLElement;
  private editStatusEl!: HTMLElement;
  private connection!: HTMLElement;
  private toasts!: Toasts;
  private palette!: CommandPalette;

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    applyTheme(readTheme());
    this.renderShell();
    document.addEventListener('keydown', (event) => {
      this.onKeyDown(event);
    });
    document.addEventListener('keyup', (event) => {
      this.onKeyUp(event);
    });
    window.addEventListener('blur', () => {
      for (const { row, col } of this.physical.values()) this.k3d?.release(row, col);
      this.physical.clear();
    });
    window.addEventListener('resize', () => {
      this.layoutScene();
    });
    window.addEventListener('blur', () => {
      this.keyCapture.reset();
    });
    if (this.support === 'ok') {
      navigator.hid.addEventListener('disconnect', (event) => {
        if (this.session?.device === event.device) {
          this.session.preview.stop();
          this.stopLinkPoll();
          this.session = undefined;
          this.renderWorkspace();
          this.status('warn', t('connect.disconnected'));
        }
      });
      void this.reconnect();
    }
    this.renderWorkspace();
  }

  // ---------------------------------------------------------------------------------------------
  // Coque
  // ---------------------------------------------------------------------------------------------

  private renderShell(): void {
    const support = SUPPORT_MESSAGES[this.support];
    this.stage = h('div', { class: 'stage', id: 'stage' });
    this.planFrame = h('div', { class: 'plan-frame', hidden: true });
    this.loader = h('div', { id: 'loader', hidden: true }, h('i'));
    this.stage.append(this.planFrame, this.loader);

    this.views = new Seg<ViewChoice>({
      label: t('kbview.label'),
      role: 'pressed',
      id: 'views',
      className: 'glass views',
      options: VIEWS.map(([value, label]) => ({ value, label: t(label) })),
      value: this.viewChoice(),
      onChange: (value) => {
        this.setView(value);
      },
    });

    this.undoButton = this.roundButton(
      'undo',
      'undo',
      `${t('edit.undo')} (Ctrl+Z)`,
      () => void this.travel('undo'),
    );
    this.redoButton = this.roundButton(
      'redo',
      'redo',
      `${t('edit.redo')} (Ctrl+Maj+Z)`,
      () => void this.travel('redo'),
    );
    this.pill = h('button', { class: 'pill glass', id: 'pill', type: 'button', 'data-state': 'off' });
    this.pill.addEventListener('click', () => {
      if (this.session) this.openScrim(this.device);
      else this.root.querySelector<HTMLButtonElement>('#connect')?.focus();
    });
    this.displayButton = this.roundButton('display-button', 'sliders', t('display.title'), () => {
      this.display.toggle();
      this.displayButton.setAttribute('aria-expanded', String(this.display.open));
    });
    this.displayButton.setAttribute('aria-expanded', 'false');
    this.displayButton.setAttribute('aria-controls', 'display-pop');
    const commandButton = this.roundButton('command-button', 'search', t('palette.button'), () => {
      this.palette.show();
    });
    const helpButton = this.roundButton('help-button', 'help', t('guide.open'), () => {
      this.guide.show();
    });
    this.guide = new Guide({
      onUseCode: (code) => {
        this.setTab('keys');
        this.ws?.picker.setExpression(code);
      },
      onOpenTab: (tab) => {
        this.setTab(tab);
      },
      layersExtra: () => {
        const session = this.session;
        const triple = session && tripleTap(session.profile);
        return session && triple
          ? t('guide.layers.triple', { key: triple.label, layer: layerName(session.profile, triple.layer) })
          : undefined;
      },
    });
    this.display = new DisplayPop({
      ledDisplay: this.ledDisplay,
      onLedDisplay: (value) => {
        this.ledDisplay = value;
        saveLedDisplay(value);
        this.updatePreview();
        this.showLedState();
        this.paintPreview();
      },
      layout: this.layout,
      onLayout: (value) => {
        this.layout = value;
        saveLabelLayout(value);
        this.renderWorkspace();
      },
      theme: readTheme(),
      onTheme: (value) => {
        applyTheme(value);
        this.refreshRail();
      },
      split: this.split,
      onSplit: (split) => {
        this.k3d?.setSplit(split);
      },
      caseOn: this.caseOn,
      onCase: (on) => {
        this.caseOn = on;
        this.k3d?.setCase(on);
      },
    });
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Node;
      if (
        this.display.open &&
        !this.display.element.contains(target) &&
        !this.displayButton.contains(target)
      ) {
        this.display.toggle(false);
        this.displayButton.setAttribute('aria-expanded', 'false');
      }
    });

    const top = h(
      'header',
      { class: 'top' },
      h('div', { class: 'brand' }, brandMark(), 'Colagan ', h('span', { text: 'Studio' })),
      this.views.element,
      h(
        'div',
        { class: 'actions' },
        this.undoButton,
        this.redoButton,
        this.pill,
        this.displayButton,
        helpButton,
        commandButton,
        this.display.element,
      ),
    );

    this.rail = new LayerRail((layer) => {
      this.setLayer(layer);
    });

    this.tabs = new Seg<InspectorTab>({
      label: t('inspector.label'),
      role: 'tab',
      id: 'inspector-tabs',
      className: 'plain',
      options: [
        { value: 'keys', label: t('view.keys'), id: 'tab-keys' },
        { value: 'light', label: t('view.light'), id: 'tab-light' },
        { value: 'dynamic', label: t('view.dynamic'), id: 'tab-dynamic' },
        { value: 'try', label: t('view.try'), id: 'tab-try' },
      ],
      value: this.tab,
      onChange: (tab) => {
        this.setTab(tab);
      },
    });
    const sheetToggle = h(
      'button',
      { class: 'round sheet-toggle', type: 'button', 'aria-label': t('inspector.collapse') },
      icon('chevron', 16, 2.2),
    );
    sheetToggle.addEventListener('click', () => {
      this.inspector.classList.toggle('collapsed');
      this.layoutScene();
    });
    const panel = (id: InspectorTab): HTMLElement =>
      h('section', {
        class: 'panel',
        id: `panel-${id}`,
        role: 'tabpanel',
        'aria-labelledby': `tab-${id}`,
        hidden: id !== this.tab,
      });
    this.panels = {
      keys: panel('keys'),
      light: panel('light'),
      dynamic: panel('dynamic'),
      try: panel('try'),
    };
    this.inspector = h(
      'aside',
      { class: 'inspector glass', id: 'inspector', 'aria-label': t('inspector.label') },
      h('div', { class: 'insp-head' }, this.tabs.element, sheetToggle),
      ...Object.values(this.panels),
    );
    if (innerWidth <= 820) this.inspector.classList.add('collapsed');
    new ResizeObserver(() => {
      this.layoutScene();
    }).observe(this.inspector);

    this.ticker = h('div', { class: 'ticker glass idle', 'aria-hidden': 'true' });
    this.toasts = new Toasts();

    this.connection = h('p', { class: 'status', id: 'connection', role: 'status', 'aria-live': 'polite' });
    const connect = h('button', {
      class: 'btn primary',
      id: 'connect',
      type: 'button',
      text: t('connect.button'),
      disabled: this.support !== 'ok',
    });
    connect.addEventListener('click', () => void this.connect());
    const demo = h('button', { class: 'btn', id: 'demo', type: 'button', text: t('demo.button') });
    demo.addEventListener('click', () => void this.startDemo());
    this.welcome = h(
      'div',
      { class: 'welcome', id: 'welcome' },
      h(
        'section',
        { class: 'sheet glass', 'aria-labelledby': 'welcome-title' },
        brandMark(44),
        h('h1', { id: 'welcome-title', text: t('app.title') }),
        h('p', { text: t('app.subtitle') }),
        h('p', { class: 'status', id: 'support', 'data-level': support.level, text: t(support.key) }),
        h('div', { class: 'btns' }, connect, demo),
        this.connection,
      ),
    );

    this.device = h('div', { class: 'scrim', id: 'device', hidden: true });
    this.device.addEventListener('pointerdown', (event) => {
      if (event.target === this.device) this.device.hidden = true;
    });
    this.palette = new CommandPalette(() => this.commands());
    this.siri = h('div', { id: 'siri', 'aria-hidden': 'true' });
    this.tip = h('div', { id: 'tip', class: 'glass', hidden: true });
    this.editStatusEl = h('p', {
      class: 'sr-only',
      id: 'edit-status',
      role: 'status',
      'aria-live': 'polite',
    });

    this.ui = h(
      'div',
      { class: 'ui' },
      top,
      this.welcome,
      this.rail.element,
      this.rail.card,
      this.inspector,
      this.ticker,
      this.toasts.element,
    );
    this.root.replaceChildren(
      this.stage,
      this.ui,
      this.siri,
      this.tip,
      this.device,
      this.guide.element,
      this.palette.element,
      this.editStatusEl,
    );
    document.title = t('app.title');
    // largeurs des pastilles connues une fois les polices chargées
    void document.fonts.ready.then(() => {
      this.layoutScene();
    });
  }

  private roundButton(
    id: string,
    name: Parameters<typeof icon>[0],
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = h(
      'button',
      { class: 'round glass', id, type: 'button', 'aria-label': label, title: label },
      icon(name),
    );
    button.addEventListener('click', onClick);
    return button;
  }

  private openScrim(scrim: HTMLElement): void {
    this.device.hidden = scrim !== this.device;
    scrim.hidden = false;
    scrim.querySelector<HTMLElement>('button')?.focus();
  }

  private viewChoice(): ViewChoice {
    return this.keyboardView === 'plan' || this.k3dFailed ? 'plan' : this.sceneView;
  }

  /**
   * Zone libre entre les panneaux : la caméra 3D (ou le plan) s'y centre. Les vues (en haut), la barre des
   * couches (en bas), le défilant et les toasts sont alignés sur son axe (variables CSS --axis, --dock-space).
   */
  private layoutScene(): void {
    const W = innerWidth;
    const H = innerHeight;
    let insets = { left: 16, right: 16, top: 76, bottom: 24 };
    if (this.session) {
      this.rail.sync();
      const dock = this.rail.element.getBoundingClientRect();
      this.ui.style.setProperty('--dock-space', `${String(Math.round(H - dock.top))}px`);
      const inspector = this.inspector.getBoundingClientRect();
      const views = this.views.element.getBoundingClientRect();
      insets =
        W <= 820
          ? { left: 0, right: 0, top: views.bottom + 6, bottom: H - Math.min(inspector.top, dock.top) + 6 }
          : { left: 28, right: W - inspector.left + 8, top: views.bottom + 12, bottom: H - dock.top + 10 };
    }
    this.k3d?.setInsets(insets);
    Object.assign(this.planFrame.style, {
      left: `${String(insets.left)}px`,
      right: `${String(insets.right)}px`,
      top: `${String(insets.top)}px`,
      bottom: `${String(insets.bottom)}px`,
    });
    this.views.sync();
    this.tabs.sync();
  }

  // ---------------------------------------------------------------------------------------------
  // Connexion
  // ---------------------------------------------------------------------------------------------

  private status(level: Level, message: string): void {
    this.connection.dataset.level = level;
    this.connection.textContent = message;
    if (this.session && level !== 'ok') this.toasts.show(message, level);
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
    this.status('error', `${t('connect.error', { message: errorMessage(error) })} ${t('connect.linuxHint')}`);
  }

  private async attach(transport: Transport, demo: boolean, device?: HIDDevice): Promise<void> {
    this.status('info', t('connect.loading'));
    this.glow(4000);
    const client = await KeyboardClient.connect(transport);
    const { info } = client;
    const catalog = new KeycodeCatalog({
      layers: info.layers,
      macroCount: info.macroCount,
      tapDanceCount: info.dynamic.tapDance,
      customKeycodes: info.definition.customKeycodes ?? [],
    });
    const keys = parseKle(info.definition.layouts.keymap);
    const profile = profileFor(info.uid);
    this.session?.preview.stop();
    const preview = new LedPreview(transport, {
      onFrame: (paints) => {
        this.livePaints = paints;
        this.paintPreview();
      },
      // le clavier affiche la couche éditée : dans l'onglet Lumière, ou quand le dessin montre la couche
      previewLayer: () => (this.tab === 'light' || this.ledDisplay === 'layer' ? this.layer : null),
      onInfo: (ledInfo) => {
        if (ledInfo.activeLayer !== this.keyboardLayer) {
          this.keyboardLayer = ledInfo.activeLayer;
          this.refreshRail();
        }
        this.applyLink(ledInfo);
      },
      onState: (state, detail) => {
        this.ledState = { state, ...(detail ? { detail } : {}) };
        this.showLedState();
      },
    });
    const keymap: KeymapView = {
      layers: info.layers,
      positions: keys.map((k) => [k.row, k.col] as const),
      getKey: (l, r, c) => client.getKey(l, r, c),
      serialize: (code) => catalog.serialize(code),
    };
    const triple = tripleTap(profile);
    this.ledState = { state: 'idle' };
    this.livePaints = new Map();
    this.keyboardLayer = undefined;
    this.link = undefined;
    this.k3d?.setLink(undefined);
    this.colorPanelKey = '';
    this.session = {
      client,
      catalog,
      keys,
      profile,
      demo,
      ...(device ? { device } : {}),
      editor: new KeyEditor(client, this.dynamicStore(), this.ledStore()),
      rgb: info.rgb
        ? new RgbController(transport, info.rgb.initialMode, {
            maxBrightness: info.rgb.info.maxBrightness,
            onError: (error) => {
              this.editStatus('error', t('rgb.error', { message: errorMessage(error) }));
            },
          })
        : undefined,
      preview,
      keymap,
      sim: new FirmwareSim(keymap, triple ? { code: triple.code, layer: triple.layer } : undefined),
      lighting: undefined,
      lightingLoad: undefined,
      dynamic: undefined,
    };
    const initialEffect = info.rgb?.initialMode.effect ?? 0;
    this.lastEffect = initialEffect || (info.rgb?.supportedEffects.find((e) => e !== 0) ?? 0);
    this.dynamicPanel = undefined;
    this.layer = 0;
    this.selected = undefined;
    this.tryOutput = [];
    this.status(
      'ok',
      t('connect.ready', {
        name: info.definition.name ?? device?.productName ?? '?',
        layers: info.layers,
        keys: keys.length,
      }),
    );
    // tests de bout en bout : débrancher puis rebrancher la moitié gauche du clavier simulé
    if (navigator.webdriver && transport instanceof FakeKeyboard)
      Object.assign(window, {
        __demo: {
          setRemote: (connected: boolean) => {
            transport.remoteConnected = connected;
          },
        },
      });
    this.renderWorkspace();
    this.startLinkPoll();
    this.k3d?.flash();
    this.toasts.show(
      demo
        ? t('demo.banner')
        : t('connect.toast', { name: info.definition.name ?? device?.productName ?? '?' }),
      demo ? 'info' : 'ok',
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Espace de travail
  // ---------------------------------------------------------------------------------------------

  /** (Re)construit tout ce qui dépend de la session (le plan, la 3D et les panneaux). */
  private renderWorkspace(): void {
    const session = this.session;
    this.k3d?.dispose();
    this.k3d = undefined;
    this.planKeys = undefined;
    this.planFrame.replaceChildren();
    this.planFrame.hidden = true;
    this.loader.hidden = true;
    this.ws = undefined;
    for (const p of Object.values(this.panels)) p.replaceChildren();
    this.welcome.hidden = Boolean(session);
    this.views.element.hidden = !session;
    this.rail.element.hidden = !session;
    this.rail.card.hidden = !session;
    this.inspector.hidden = !session;
    this.display.showSceneControls(Boolean(session) && this.viewChoice() !== 'plan');
    this.updatePill();
    if (!session) {
      this.undoButton.hidden = this.redoButton.hidden = true;
      this.device.hidden = true;
      this.layoutScene();
      return;
    }

    const { client, profile } = session;
    this.rail.setLayers(
      Array.from({ length: client.info.layers }, (_, layer) => ({
        name: layerName(profile, layer),
        description: layerDescription(profile, layer) ?? '',
        tint: layerTint(profile, layer),
      })),
    );

    const picker = new KeycodePicker({
      catalog: session.catalog,
      layout: this.layout,
      onPick: (code) => void this.assign(code),
    });
    const keyHead = h('div', { class: 'panel-part', id: 'key-details', tabindex: -1 });
    const holdLink = h('button', {
      class: 'link',
      type: 'button',
      id: 'guide-hold-link',
      text: t('guide.holdLink'),
    });
    holdLink.addEventListener('click', () => {
      this.guide.show('hold');
    });
    const pickerHead = h(
      'div',
      { class: 'h' },
      h('span', { text: t('picker.title') }),
      holdLink,
      h('small', { id: 'picker-hint' }),
    );
    this.panels.keys.append(keyHead, pickerHead, picker.element);
    const colorBox = h('div', { class: 'panel-part', id: 'color-box' });
    this.panels.light.append(colorBox);
    const dynamicBox = h('div', { class: 'panel-part', id: 'section-dynamic' });
    this.panels.dynamic.append(dynamicBox);
    const tryBox = h('div', { class: 'panel-part', id: 'try-box' });
    this.panels.try.append(tryBox);
    const previews = new EffectPreviews(previewKeys(session.keys), () => {
      const mode = session.rgb?.mode;
      return { hue: mode?.hue ?? 0, saturation: mode?.saturation ?? 255, speed: mode?.speed ?? 80 };
    });
    this.ws = { picker, keyHead, colorBox, dynamicBox, tryBox, previews };
    this.renderDevice(session);
    this.setTab(this.tab, false);
    this.showLedState();
    this.refresh();
    this.layoutScene();
  }

  private updatePill(): void {
    const session = this.session;
    const link = session ? this.link : undefined;
    // une seule moitié, ou la gauche au PC (keymap lue dans sa mémoire) : point orange
    const partial = Boolean(link && (!link.remote || link.master === 'left'));
    const state = !session ? 'off' : partial ? 'partial' : session.demo ? 'demo' : 'on';
    this.pill.dataset.state = state;
    const name = session?.client.info.definition.name ?? session?.device?.productName ?? '';
    this.pill.replaceChildren(
      h('span', { class: 'orb' }),
      !session ? t('pill.offline') : h('span', { class: 'pname', text: name }),
    );
    if (session) {
      const sub =
        !link || !partial
          ? session.demo
            ? t('pill.demo')
            : t('pill.connected')
          : !link.remote
            ? t(link.master === 'left' ? 'pill.leftAlone' : 'pill.rightAlone')
            : t('pill.masterLeft');
      this.pill.append(' ', h('span', { class: 'sub', text: sub }));
    }
    this.pill.setAttribute('aria-label', session ? t('pill.open', { name }) : t('pill.offline'));
    this.pill.title = link ? this.linkText(link) : '';
  }

  /** « Droite branchée au PC (maître) · gauche reliée ». */
  private linkText(link: SplitLink): string {
    const left = link.master === 'left';
    return t('device.halvesValue', {
      master: t(left ? 'split.left' : 'split.right'),
      other: t(left ? 'split.rightLower' : 'split.leftLower'),
      state: t(link.remote ? 'device.linked' : 'device.unlinked'),
    });
  }

  /** Lien entre moitiés lu dans la réponse info 0xC0 : scène 3D, pastille, feuille du clavier, toasts. */
  private applyLink(info: LedStreamInfo): void {
    const link: SplitLink = { master: info.masterIsLeft ? 'left' : 'right', remote: info.remoteConnected };
    const before = this.link;
    if (before?.master === link.master && before.remote === link.remote) return;
    this.link = link;
    this.k3d?.setLink(link);
    this.updatePill();
    if (this.deviceHalves) this.deviceHalves.textContent = this.linkText(link);
    const other = t(link.master === 'left' ? 'split.rightLower' : 'split.leftLower');
    if (link.master === 'left' && before?.master !== 'left') this.toasts.show(t('split.leftMaster'), 'warn');
    else if (!link.remote && (before?.remote ?? true))
      this.toasts.show(t('split.lost', { side: other }), 'warn');
    else if (link.remote && before?.remote === false)
      this.toasts.show(t('split.back', { side: other }), 'ok');
  }

  /** L'aperçu LED relit l'état du clavier toutes les secondes ; sans lui (LED masquées), relecture lente. */
  private startLinkPoll(): void {
    this.stopLinkPoll();
    const session = this.session;
    if (!session) return;
    this.linkTimer = window.setInterval(() => {
      if (this.session !== session) {
        this.stopLinkPoll();
        return;
      }
      if (!session.preview.active) void session.preview.refreshInfo();
    }, LINK_POLL_MS);
    if (!session.preview.active) void session.preview.refreshInfo();
  }

  private stopLinkPoll(): void {
    window.clearInterval(this.linkTimer);
    this.linkTimer = undefined;
  }

  /** Feuille du clavier (clic sur la pastille) : informations, sauvegarde .vil et instantanés. */
  private renderDevice(session: Session): void {
    const { info } = session.client;
    const name = info.definition.name ?? session.device?.productName ?? '?';
    const items: [string, string][] = [
      [t('device.protocol'), `VIA ${String(info.viaProtocol)} · Vial ${String(info.vialProtocol)}`],
      [t('device.layers'), String(info.layers)],
      [t('device.keys'), String(session.keys.length)],
      [
        t('device.dynamic'),
        t('device.dynamicValue', {
          macros: info.macroCount,
          td: info.dynamic.tapDance,
          combos: info.dynamic.combo,
        }),
      ],
      [
        t('device.rgb'),
        info.rgb
          ? t('device.rgbValue', {
              effects: info.rgb.supportedEffects.length,
              max: info.rgb.info.maxBrightness,
            })
          : t('device.rgbNone'),
      ],
    ];
    this.deviceHalves = h('span', {
      class: 'v',
      id: 'device-halves',
      text: this.link ? this.linkText(this.link) : '…',
    });
    const backup = renderBackupPanel({
      client: session.client,
      catalog: session.catalog,
      positions: new Set(session.keys.map((k) => keyId(k.row, k.col))),
      keyboardName: name,
      ensureUnlocked: () => this.ensureUnlocked(),
      onImported: () => {
        session.editor.clear();
        // macros / tap-dance / combos relus à la prochaine ouverture de l'onglet
        session.dynamic = undefined;
        this.dynamicPanel = undefined;
        this.ws?.dynamicBox.replaceChildren();
        this.refresh();
      },
    });
    const close = h('button', {
      class: 'btn primary',
      type: 'button',
      id: 'device-close',
      text: t('device.close'),
    });
    close.addEventListener('click', () => {
      this.device.hidden = true;
    });
    const change = h('button', {
      class: 'btn',
      type: 'button',
      text: t('device.change'),
      disabled: this.support !== 'ok',
    });
    change.addEventListener('click', () => {
      this.device.hidden = true;
      void this.connect();
    });
    const demo = h('button', { class: 'btn', type: 'button', text: t('device.demo') });
    demo.addEventListener('click', () => {
      this.device.hidden = true;
      void this.startDemo();
    });
    this.device.replaceChildren(
      h(
        'div',
        { class: 'sheet glass', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'device-title' },
        h('h2', { id: 'device-title', text: name }),
        h('p', { text: session.demo ? t('demo.banner') : t('device.live') }),
        h(
          'div',
          { class: 'group' },
          ...items.map(([label, value]) =>
            h('div', { class: 'item' }, h('span', { text: label }), h('span', { class: 'v', text: value })),
          ),
          h('div', { class: 'item' }, h('span', { text: t('device.halves') }), this.deviceHalves),
        ),
        h('div', { class: 'h', text: t('view.backup') }),
        backup,
        h('div', { class: 'btns' }, change, demo, close),
      ),
    );
  }

  private setTab(tab: InspectorTab, refresh = true): void {
    if (tab !== 'keys') this.stopCapture();
    this.tab = tab;
    this.tabs.set(tab);
    for (const [id, panel] of Object.entries(this.panels)) panel.hidden = id !== tab;
    if (this.inspector.classList.contains('collapsed') && refresh) {
      this.inspector.classList.remove('collapsed');
      this.layoutScene();
    }
    const session = this.session;
    if (session && this.ws) {
      if (tab === 'dynamic' && !this.ws.dynamicBox.hasChildNodes()) void this.loadDynamic(this.ws.dynamicBox);
      if (tab === 'try') session.sim.reset(this.layer);
      if (tab !== 'light') this.colorPanelKey = '';
    }
    this.updatePreview();
    if (refresh) this.refresh();
  }

  private setView(view: ViewChoice): void {
    if (view === 'plan') {
      this.keyboardView = 'plan';
    } else {
      if (this.k3dFailed) {
        this.toasts.show(t('kbview.unsupported'), 'warn');
        this.views.set('plan');
        return;
      }
      this.keyboardView = '3d';
      this.sceneView = view;
      this.k3d?.setView(view);
    }
    saveKeyboardView(this.keyboardView);
    this.display.showSceneControls(this.viewChoice() !== 'plan');
    this.refresh();
  }

  private setLayer(layer: number): void {
    if (!this.session || layer < 0 || layer >= this.session.client.info.layers) return;
    this.layer = layer;
    if (this.tab === 'try') this.session.sim.reset(layer);
    this.refresh();
  }

  /** Mode de la scène selon l'onglet : choisir, peindre ou essayer les touches. */
  private sceneMode(): SceneMode {
    return this.tab === 'light' ? 'paint' : this.tab === 'try' ? 'try' : 'keys';
  }

  /** Charge la vue 3D (three.js dans un fichier séparé) puis redessine ; reste en plan si WebGL manque. */
  private load3d(session: Session): void {
    if (this.k3dLoading || this.k3dFailed) return;
    this.k3dLoading = true;
    this.loader.hidden = false;
    this.loader.classList.remove('done');
    import('./keyboard-3d/keyboard-3d')
      .then(({ Keyboard3D }) => {
        if (this.session !== session || this.viewChoice() === 'plan' || this.k3d) return;
        if (!Keyboard3D.supported()) {
          this.k3dFailed = true;
          this.toasts.show(t('kbview.unsupported'), 'warn');
          return;
        }
        const part = (name: string): readonly [string, string] => [
          t(`kbview.part.${name}` as MessageKey),
          t(`kbview.part.${name}.sub` as MessageKey),
        ];
        this.k3d = new Keyboard3D({
          keys: session.keys,
          model: session.profile?.model3d,
          text: {
            canvas: t('kbview.canvas'),
            parts: {
              caps: part('caps'),
              switches: part('switches'),
              leds: part('leds'),
              case: part('case'),
              pcb: part('pcb'),
              sockets: part('sockets'),
              pico: part('pico'),
              usb: part('usb'),
            },
            halves: {
              left: t('split.left'),
              right: t('split.right'),
              master: t('split.master'),
              masterLong: t('split.masterLong'),
            },
          },
          onKeyClick: (row, col, event) => {
            this.activateKey(row, col, event);
          },
          onBackgroundClick: () => {
            if (this.selected) {
              this.selected = undefined;
              this.refresh();
            }
          },
          onPaintStart: (row, col, event) => {
            if (event.altKey) this.paintKey(row, col, event);
            else this.dragStart(row, col);
          },
          onPaintEnter: (row, col) => {
            this.dragAdd(row, col);
          },
          onPaintEnd: () => {
            this.dragEnd(true);
          },
          onTryPress: (row, col) => {
            this.tryPress(row, col);
          },
          onTryRelease: (row, col) => {
            this.tryRelease(row, col);
          },
          onHover: (hit, event) => {
            this.showTip(hit, event);
          },
          onDrop: (row, col, data) => {
            this.dropKeycode(row, col, data);
          },
          onLayerPick: (layer, key) => {
            this.setLayer(layer);
            if (key && this.tab === 'keys') {
              this.selected = key;
              this.refresh();
            }
          },
          onReady: () => {
            this.loader.classList.add('done');
            setTimeout(() => {
              this.loader.hidden = true;
            }, 900);
          },
        });
        this.k3d.setSplit(this.split);
        this.k3d.setCase(this.caseOn);
        this.k3d.setView(this.sceneView);
        this.k3d.setLink(this.link);
        // tests de bout en bout (navigateur piloté) : position écran d'une touche 3D
        if (navigator.webdriver) {
          Object.assign(window, {
            __studio: { keyPoint: (row: number, col: number) => this.k3d?.screenPoint(row, col) },
          });
        }
      })
      .catch((error: unknown) => {
        this.k3dFailed = true;
        this.toasts.show(t('kbview.error', { message: errorMessage(error) }), 'warn');
      })
      .finally(() => {
        this.k3dLoading = false;
        if (!this.k3d) this.loader.hidden = true;
        if (this.session === session) {
          this.views.set(this.viewChoice());
          this.refresh();
          this.layoutScene();
        }
      });
  }

  /** Clic (ou Entrée) sur une touche, quelle que soit la vue, selon l'onglet. */
  private activateKey(row: number, col: number, event: MouseEvent | KeyboardEvent): void {
    if (this.tab === 'light') {
      this.paintKey(row, col, event);
      return;
    }
    if (this.tab === 'try') {
      this.tryPress(row, col);
      this.tryRelease(row, col);
      return;
    }
    this.selected = { row, col };
    if (innerWidth <= 820) this.inspector.classList.remove('collapsed');
    this.refresh();
    this.planFrame.querySelector<SVGGElement>(`[data-key="${keyId(row, col)}"]`)?.focus();
  }

  /** Couleurs sur le dessin affiché (3D ou plan). */
  private showPaints(paints: LedPaints): void {
    if (this.k3d) this.k3d.setPaints(paints);
    else if (this.planKeys) paintLeds(this.planKeys, paints);
  }

  /** Lecture paresseuse des couleurs par couche (onglet Lumière, affichage de la couche, pile). */
  private ensureLighting(): void {
    const session = this.session;
    if (!session || session.lighting !== undefined || session.lightingLoad) return;
    session.lightingLoad = LayerLighting.load(session.client.transport)
      .then((lighting) => {
        session.lighting = lighting ?? null;
      })
      .catch((error: unknown) => {
        session.lighting = null;
        this.editStatus('error', t('colors.loadError', { message: errorMessage(error) }));
      })
      .finally(() => {
        session.lightingLoad = undefined;
        if (this.session === session) this.refresh();
      });
  }

  private updatePreview(): void {
    const session = this.session;
    if (!session) return;
    // les mini-cartes du rail et la pile montrent les couleurs des couches : lues dès la connexion
    this.ensureLighting();
    const run = this.ledDisplay !== 'off' || this.tab === 'light';
    if (run) session.preview.start();
    else if (session.preview.active) session.preview.stop();
  }

  /** Couleurs enregistrées d'une couche (exactes) ; null = transparente (laisse voir l'effet). */
  private layerPaints(layer: number, live: LedPaints | undefined): Map<string, LedPaint> {
    const paints = new Map<string, LedPaint>();
    const session = this.session;
    const lighting = session?.lighting;
    if (!session || !lighting) return paints;
    for (const k of session.keys) {
      const id = keyId(k.row, k.col);
      const color = lighting.color(layer, k.row, k.col);
      if (color === undefined) continue;
      if (color === null) paints.set(id, live?.get(id) ?? { kind: 'effect' });
      else if (color[0] || color[1] || color[2]) paints.set(id, { kind: 'on', css: cssColor(color) });
      else paints.set(id, { kind: 'off' });
    }
    return paints;
  }

  /**
   * Couleur de chaque touche sur le dessin : couleurs enregistrées de la couche (exactes) quand on montre la
   * couche ; l'état réel du clavier pour les touches transparentes et en mode « Clavier en direct ».
   */
  private paintPreview(): void {
    const session = this.session;
    if (!session) return;
    const showLayer = Boolean(session.lighting) && (this.tab === 'light' || this.ledDisplay === 'layer');
    const showLive = this.ledDisplay !== 'off';
    if (!showLayer) {
      this.showPaints(showLive ? this.livePaints : new Map());
      return;
    }
    this.showPaints(this.layerPaints(this.layer, showLive ? this.livePaints : undefined));
  }

  private refreshRail(): void {
    const session = this.session;
    if (!session) return;
    this.rail.update(this.layer, this.keyboardLayer);
    const { client, keys, lighting } = session;
    for (let layer = 0; layer < client.info.layers; layer++) {
      this.rail.setAccess(layer, this.accessText(session, layer));
      const mini: MiniKey[] = keys.map((geometry) => {
        const code = client.getKey(layer, geometry.row, geometry.col);
        const color = lighting?.color(layer, geometry.row, geometry.col);
        return {
          geometry,
          kind: code === 0 ? 'none' : code === 1 ? 'transparent' : 'normal',
          ...(color && (color[0] || color[1] || color[2]) ? { color: cssColor(color) } : {}),
        };
      });
      this.rail.drawMini(layer, mini);
    }
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
          true,
        );
      }
    } catch (error) {
      session.lighting.stage(layer, before);
      this.editStatus('error', t('colors.error', { message: errorMessage(error) }));
    }
    this.refresh();
  }

  /** Clic (ou Entrée) dans l'onglet Lumière : peint la touche, ou reprend sa couleur avec Alt. */
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

  /** Remplir la couche, ou la rendre entièrement transparente : une seule entrée d'historique. */
  private fillLayer(color: LayerColor): void {
    const session = this.session;
    const lighting = session?.lighting;
    if (!session || !lighting) return;
    const after = new Map<number, LayerColor>();
    for (const k of session.keys) {
      const led = lighting.led(k.row, k.col);
      if (led !== undefined) after.set(led, color);
    }
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

  /**
   * Fin du glisser. Sur le plan, le clic qui suit écrit une touche seule (paintKey) ; la 3D n'émet pas de clic
   * en mode peinture (`commitSingle`), elle écrit donc aussi la touche seule ici.
   */
  private dragEnd(commitSingle = false): void {
    const drag = this.drag;
    this.drag = undefined;
    if (!drag) return;
    if (drag.after.size <= 1 && !commitSingle) {
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

  /** Dépôt d'un keycode glissé depuis la grille sur une touche du plan. */
  private attachPlanDrop(svg: SVGSVGElement): void {
    let over: Element | undefined;
    const keyOf = (event: DragEvent): SVGGElement | null =>
      event.target instanceof Element ? event.target.closest<SVGGElement>('[data-key]') : null;
    svg.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types.includes(KEYCODE_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      const key = keyOf(event) ?? undefined;
      if (key !== over) {
        over?.classList.remove('is-drop');
        key?.classList.add('is-drop');
        over = key;
      }
    });
    svg.addEventListener('dragleave', () => {
      over?.classList.remove('is-drop');
      over = undefined;
    });
    svg.addEventListener('drop', (event) => {
      event.preventDefault();
      over?.classList.remove('is-drop');
      over = undefined;
      const [row = 0, col = 0] = (keyOf(event)?.dataset.key ?? '').split(',').map(Number);
      if (event.dataTransfer && keyOf(event)) this.dropKeycode(row, col, event.dataTransfer);
    });
  }

  private dropKeycode(row: number, col: number, data: DataTransfer): void {
    const code = Number(data.getData(KEYCODE_MIME));
    if (!Number.isInteger(code) || !data.getData(KEYCODE_MIME)) return;
    this.selected = { row, col };
    if (this.tab !== 'keys') this.setTab('keys', false);
    this.refresh();
    void this.assign(code);
  }

  private showLedState(): void {
    const el = this.display.ledStatus;
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
    const loading = h('p', { class: 'hint', text: t('dyn.loading') });
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
          this.editStatus(level, message, level === 'ok');
        },
        onChanged: () => {
          this.refresh();
        },
      });
      container.replaceChildren(this.dynamicPanel.element);
    } catch (error) {
      loading.textContent = t('dyn.loadError', { message: errorMessage(error) });
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

  private keyViews(layer: number): KeyView[] {
    const session = this.session;
    if (!session) return [];
    const { client, catalog, keys } = session;
    return keys.map((geometry) => {
      const code = client.getKey(layer, geometry.row, geometry.col);
      return {
        geometry,
        label: keyLabel(catalog, code, this.layout),
        title: catalog.tooltip(code),
        kind: code === 0 ? 'none' : code === 1 ? 'transparent' : 'normal',
      };
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Rafraîchissement
  // ---------------------------------------------------------------------------------------------

  /** Met à jour rail, dessin, inspecteur et boutons à partir de l'état courant. */
  private refresh(): void {
    const session = this.session;
    const ws = this.ws;
    if (!session || !ws) return;
    const { client, editor } = session;

    this.refreshRail();
    this.views.set(this.viewChoice());
    const views = this.keyViews(this.layer);
    const selected = this.selected ? keyId(this.selected.row, this.selected.col) : undefined;
    const use3d = this.viewChoice() !== 'plan';
    if (!use3d && this.k3d) {
      this.k3d.dispose();
      this.k3d = undefined;
    }
    if (use3d) {
      // 3D (ou son chargement, avec le loader) : le plan n'est pas dessiné
      this.planFrame.hidden = true;
      this.planFrame.replaceChildren();
      this.planKeys = undefined;
    }
    if (use3d && !this.k3d) {
      this.load3d(session);
    } else if (this.k3d) {
      if (this.k3d.element.parentElement !== this.stage) this.stage.prepend(this.k3d.element);
      this.k3d.setState({
        views,
        selected: this.tab === 'keys' ? selected : undefined,
        layer: this.layer,
        mode: this.sceneMode(),
      });
      if (this.sceneView === 'stack') this.k3d.setStack(this.stackLayers());
    } else {
      // plan SVG : vue choisie, ou WebGL indisponible
      const keyboard = renderKeyboard({
        keys: views,
        ...(selected && this.tab === 'keys' ? { selected } : {}),
        onSelect: (row, col, event) => {
          this.activateKey(row, col, event);
        },
      });
      if (this.tab === 'light') {
        keyboard.classList.add('keyboard--paint');
        this.attachPaintDrag(keyboard);
      }
      this.attachPlanDrop(keyboard);
      this.planKeys = keyboard;
      this.planFrame.replaceChildren(keyboard);
      this.planFrame.hidden = false;
    }
    this.paintPreview();

    if (this.tab === 'keys') this.renderKeyHead(session, ws);
    if (this.tab === 'light') this.renderColorBox(session, ws);
    if (this.tab === 'try') this.renderTry(session, ws);

    this.undoButton.hidden = !editor.canUndo;
    this.redoButton.hidden = !editor.canRedo;
    ws.picker.setEnabled(Boolean(this.selected));
    ws.picker.setCurrent(
      this.selected ? client.getKey(this.layer, this.selected.row, this.selected.col) : undefined,
    );
    const hint = ws.picker.element.parentElement?.querySelector('#picker-hint');
    if (hint) hint.textContent = this.selected ? t('picker.hintSelected') : t('picker.hintDrag');
  }

  private stackLayers(): StackLayer[] {
    const session = this.session;
    if (!session) return [];
    return Array.from({ length: session.client.info.layers }, (_, layer) => ({
      views: this.keyViews(layer),
      paints: this.layerPaints(layer, undefined),
      tint: layerTint(session.profile, layer),
      name: layerName(session.profile, layer),
    }));
  }

  /** Onglet Touches : touche choisie (ou état vide) et la couche affichée. */
  private renderKeyHead(session: Session, ws: Workspace): void {
    const { client, catalog, profile, keymap } = session;
    const name = layerName(profile, this.layer);
    if (!this.selected) {
      // plus de touche choisie : la capture s'arrête (sans redessiner, on est déjà en train de le faire)
      this.capturing = false;
      this.keyCapture.reset();
      let assigned = 0;
      let transparent = 0;
      for (const k of session.keys) {
        const code = client.getKey(this.layer, k.row, k.col);
        if (code === 1) transparent++;
        else if (code !== 0) assigned++;
      }
      ws.keyHead.replaceChildren(
        h(
          'div',
          { class: 'empty' },
          icon('keyboard', 34, 1.5),
          h('b', { text: t('key.noneTitle') }),
          h('span', { text: t('key.none') }),
        ),
        h('div', { class: 'h', text: name }),
        h(
          'div',
          { class: 'group' },
          this.infoItem(t('key.access'), this.accessText(session, this.layer)),
          this.infoItem(t('key.count'), t('key.countValue', { assigned, transparent })),
        ),
      );
      return;
    }
    const { row, col } = this.selected;
    const own = client.getKey(this.layer, row, col);
    const resolved = own === 1 ? resolveKey(keymap, this.layer, row, col) : { code: own, layer: this.layer };
    const label = keyLabel(catalog, resolved.code, this.layout);
    const title =
      own === 0
        ? t('key.empty')
        : own === 1
          ? `▽ ${flatLabel(label)}`
          : flatLabel(label) || catalog.serialize(own);
    const led = session.lighting?.led(row, col);
    const ledColor = session.lighting?.color(this.layer, row, col);
    const geometry = session.keys.find((k) => k.row === row && k.col === col);
    const halves = profile?.model3d?.outlines.length === 2;
    const half =
      halves && geometry
        ? geometry.x + geometry.w / 2 < Math.max(...session.keys.map((k) => k.x + k.w)) / 2
          ? t('key.left')
          : t('key.right')
        : '';
    const cap = this.keycap(
      label,
      own,
      ledColor && (ledColor[0] || ledColor[1] || ledColor[2]) ? cssColor(ledColor) : undefined,
    );
    const across = Array.from({ length: client.info.layers }, (_, layer) => {
      const code = client.getKey(layer, row, col);
      const text =
        code === 0
          ? '—'
          : code === 1
            ? '▽'
            : flatLabel(keyLabel(catalog, code, this.layout)) || catalog.serialize(code);
      const button = h(
        'button',
        { type: 'button', class: `item${layer === this.layer ? ' is-cur' : ''}`, 'data-goto': layer },
        h('span', { class: 'k' }, this.tintDot(layerTint(profile, layer)), layerName(profile, layer)),
        h('span', { class: 'v', text }),
      );
      button.addEventListener('click', () => {
        this.setLayer(layer);
      });
      return button;
    });
    const capture = h(
      'button',
      {
        type: 'button',
        class: `btn capture${this.capturing ? ' is-armed' : ''}`,
        id: 'key-capture',
        'aria-pressed': String(this.capturing),
        title: t('capture.label'),
      },
      icon('keyboard', 16, 2),
      h('span', { text: this.capturing ? t('capture.armed') : t('capture.start') }),
    );
    capture.addEventListener('click', () => {
      if (this.capturing) this.stopCapture();
      else this.startCapture();
    });
    ws.keyHead.replaceChildren(
      h(
        'div',
        { class: 'keyhead' },
        cap,
        h(
          'div',
          { style: 'min-width:0' },
          h('div', { class: 't', text: title }),
          h('div', {
            class: 's',
            text:
              own === 1
                ? t('key.inherited', { layer: layerName(profile, resolved.layer) })
                : catalog.tooltip(own),
          }),
        ),
      ),
      capture,
      ...(this.capturing ? [h('p', { class: 'capture-hint', text: t('capture.hint') })] : []),
      h(
        'div',
        { class: 'group' },
        this.infoItem(t('key.keycode'), catalog.serialize(own), true),
        this.infoItem(t('key.matrix'), `[${keyId(row, col)}]${half ? ` · ${half}` : ''}`),
        led !== undefined ? this.infoItem(t('key.led'), t('key.ledValue', { n: led })) : null,
        this.infoItem(t('key.layer'), name),
      ),
      h('div', { class: 'h', text: t('key.across') }),
      h('div', { class: 'group' }, ...across),
    );
  }

  private keycap(label: KeyLabel, code: number, led: string | undefined): HTMLElement {
    const main = code === 0 ? '' : label.main.replaceAll('\n', ' ');
    const cap = h(
      'div',
      {
        class: `keycap${main.length > 3 ? ' is-long' : ''}${code === 1 ? ' is-trns' : ''}`,
        'aria-hidden': 'true',
      },
      main,
      label.shift ? h('small', { class: 'ks', text: label.shift }) : null,
      label.altgr ? h('small', { class: 'ka', text: label.altgr }) : null,
    );
    if (led) cap.style.setProperty('--led', led);
    return cap;
  }

  private infoItem(label: string, value: string, code = false): HTMLElement {
    return h(
      'div',
      { class: 'item' },
      h('span', { text: label }),
      h(code ? 'code' : 'span', { class: code ? undefined : 'v', text: value }),
    );
  }

  private tintDot(tint: string): HTMLElement {
    const dot = h('span', { class: 'tdot' });
    dot.style.background = tint;
    return dot;
  }

  /** Accès à une couche, lu dans la keymap (MO, TO, LT… posés sur les autres couches). */
  private accessText(session: Session, layer: number): string {
    const accesses = layerAccesses(session.keymap, layer);
    if (!accesses.length) {
      if (layer === 0) return t('key.accessDefault');
      const triple = tripleTap(session.profile);
      return triple?.layer === layer ? triple.label : t('key.accessNone');
    }
    const parts = [...new Set(accesses.map((a) => `${a.kind} · ${layerName(session.profile, a.from)}`))];
    return parts.slice(0, 2).join(', ') + (parts.length > 2 ? '…' : '');
  }

  /** Onglet Lumière, reconstruit seulement quand la couche ou l'état de chargement change. */
  private renderColorBox(session: Session, ws: Workspace): void {
    const state = session.lighting === undefined ? 'loading' : session.lighting ? 'ready' : 'none';
    const key = `${String(this.layer)}:${state}`;
    if (key === this.colorPanelKey) return;
    this.colorPanelKey = key;
    if (state === 'loading') {
      ws.colorBox.replaceChildren(h('p', { class: 'hint', text: t('colors.loading') }));
      return;
    }
    const name = layerName(session.profile, this.layer);
    ws.colorBox.replaceChildren(
      renderColorPanel({
        lighting: session.lighting ?? undefined,
        layer: this.layer,
        layerName: name,
        brush: this.brush,
        onBrush: (brush) => {
          this.brush = brush;
        },
        onFill: (color) => {
          this.fillLayer(color);
        },
        globalRgb: session.rgb,
        supportedEffects: session.client.info.rgb?.supportedEffects ?? [],
        maxBrightness: session.client.info.rgb?.info.maxBrightness ?? 255,
        previews: ws.previews,
        onLightingToggle: (on) => {
          this.toggleLighting(on);
        },
        onReset: () => void this.resetColors(name),
        onError: (message) => {
          this.editStatus('error', message);
        },
      }),
    );
  }

  /** Interrupteur « Éclairage allumé » : effet OFF, ou retour au dernier effet allumé. */
  private toggleLighting(on: boolean): void {
    const rgb = this.session?.rgb;
    if (!rgb) return;
    if (!on && rgb.mode.effect !== 0) this.lastEffect = rgb.mode.effect;
    rgb.update({ effect: on ? this.lastEffect : 0 });
    this.colorPanelKey = '';
    this.refresh();
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
      this.editStatus('error', t('colors.error', { message: errorMessage(error) }));
    }
    this.colorPanelKey = '';
    this.refresh();
  }

  // ---------------------------------------------------------------------------------------------
  // Essai : simulation des couches sur la keymap réelle
  // ---------------------------------------------------------------------------------------------

  private renderTry(session: Session, ws: Workspace): void {
    const clear = h('button', {
      type: 'button',
      class: 'cat',
      id: 'try-clear',
      style: 'height:24px;margin-right:-6px',
      text: t('try.clear'),
    });
    clear.addEventListener('click', () => {
      this.tryOutput = [];
      this.renderTryOutput();
    });
    const triple = tripleTap(session.profile);
    const active = session.sim.activeLayers;
    ws.tryBox.replaceChildren(
      h('p', { class: 'hint', style: 'font-size:13px;padding-top:4px', text: t('try.help') }),
      h('div', { class: 'h' }, h('span', { text: t('try.output') }), clear),
      h('div', { class: 'group output', id: 'try-output', 'aria-live': 'polite' }),
      h('div', { class: 'h', text: t('try.active') }),
      h(
        'div',
        { class: 'group' },
        ...active
          .slice()
          .reverse()
          .map((layer) =>
            h(
              'div',
              { class: 'item' },
              h(
                'span',
                { class: 'k' },
                this.tintDot(layerTint(session.profile, layer)),
                layerName(session.profile, layer),
              ),
              h('span', { class: 'v', text: layer === this.layer ? t('try.shown') : t('try.below') }),
            ),
          ),
      ),
      h('div', { class: 'h', text: t('try.rules') }),
      h(
        'div',
        { class: 'group' },
        this.ruleItem('MO(n)', t('try.ruleMo')),
        this.ruleItem('TO(n)', t('try.ruleTo')),
        triple ? this.ruleItem(triple.label, t('try.ruleTriple')) : null,
        this.ruleItem('QK_BOOT, RM_*', t('try.ruleOther')),
      ),
    );
    this.renderTryOutput();
  }

  private ruleItem(code: string, text: string): HTMLElement {
    return h('div', { class: 'item' }, h('code', { text: code }), h('span', { class: 'v', text }));
  }

  private renderTryOutput(): void {
    const out = this.root.querySelector('#try-output');
    if (!out) return;
    out.replaceChildren(
      ...this.tryOutput.map((item) =>
        item.tok ? h('span', { class: 'tok', text: item.tok }) : (item.ch ?? ''),
      ),
      h('span', { class: 'caret' }),
    );
    out.scrollTop = out.scrollHeight;
  }

  private tryPress(row: number, col: number): void {
    const session = this.session;
    if (!session) return;
    this.k3d?.press(row, col);
    const event = session.sim.press(row, col);
    if (event.kind === 'layer') {
      if (event.layer !== this.layer) {
        this.layer = event.layer;
        this.toasts.show(t('try.layer', { layer: layerName(session.profile, event.layer), via: event.via }));
      }
      this.refresh();
      return;
    }
    if (event.kind === 'boot') {
      this.toasts.show(t('try.boot'), 'warn');
      return;
    }
    if (event.kind !== 'key') return;
    const code = event.code;
    const usage = code & 0xff;
    const name = session.catalog.serialize(code);
    if (code === 0x2a) this.tryOutput.pop();
    else if (code === 0x28) this.tryOutput.push({ ch: '\n' });
    else if (code === 0x2c) this.tryOutput.push({ ch: ' ' });
    else {
      const label = keyLabel(session.catalog, code, this.layout);
      const main = label.main.replaceAll('\n', ' ');
      const printable = code < 0x2000 && PRINTABLE(usage);
      if (printable && Array.from(main).length === 1)
        this.tryOutput.push({ ch: code < 0x100 ? main.toLowerCase() : main });
      else this.tryOutput.push({ tok: flatLabel(label) || name });
    }
    if (this.tryOutput.length > 400) this.tryOutput.splice(0, 100);
    this.renderTryOutput();
  }

  private tryRelease(row: number, col: number): void {
    const session = this.session;
    if (!session) return;
    this.k3d?.release(row, col);
    if (session.sim.release(row, col) && session.sim.layer !== this.layer) {
      this.layer = session.sim.layer;
      this.refresh();
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Frappes du vrai clavier : touche retrouvée dans la keymap, appui animé, défilant, lueur Siri
  // ---------------------------------------------------------------------------------------------

  private findPhysical(code: string): { row: number; col: number; label: string } | undefined {
    const session = this.session;
    if (!session) return undefined;
    const usages = hidUsages(code);
    if (!usages.length) return undefined;
    const layers = [...new Set([this.keyboardLayer ?? this.layer, this.layer, 0])];
    for (const layer of layers) {
      for (const usage of usages) {
        for (const k of session.keys) {
          const resolved = resolveKey(session.keymap, layer, k.row, k.col);
          if (sendsUsage(resolved.code, usage)) {
            const label = flatLabel(keyLabel(session.catalog, resolved.code, this.layout));
            return { row: k.row, col: k.col, label };
          }
        }
      }
    }
    return undefined;
  }

  private mirrorKey(event: KeyboardEvent): void {
    if (event.repeat || this.physical.has(event.code)) return;
    const key = this.findPhysical(event.code);
    if (!key) return;
    this.physical.set(event.code, { row: key.row, col: key.col });
    this.k3d?.press(key.row, key.col);
    this.glow(1400);
    const kbd = h('kbd', { text: key.label || '·' });
    this.ticker.append(kbd);
    while (this.ticker.children.length > 7) this.ticker.firstElementChild?.remove();
    this.ticker.classList.remove('idle');
    clearTimeout(this.tickerTimer);
    this.tickerTimer = window.setTimeout(() => {
      this.ticker.classList.add('idle');
      setTimeout(() => {
        if (this.ticker.classList.contains('idle')) this.ticker.replaceChildren();
      }, 450);
    }, 1800);
  }

  private glow(ms: number): void {
    if (REDUCED_MOTION) return;
    this.siri.classList.add('on');
    clearTimeout(this.siriTimer);
    this.siriTimer = window.setTimeout(() => {
      this.siri.classList.remove('on');
    }, ms);
  }

  private showTip(hit: SceneHit | undefined, event: PointerEvent): void {
    const session = this.session;
    if (!hit || !session || event.pointerType !== 'mouse' || this.drag) {
      this.tip.hidden = true;
      return;
    }
    const layer = hit.layer ?? this.layer;
    const own = session.client.getKey(layer, hit.row, hit.col);
    const resolved = own === 1 ? resolveKey(session.keymap, layer, hit.row, hit.col).code : own;
    const label = flatLabel(keyLabel(session.catalog, resolved, this.layout));
    const extra = hit.layer !== undefined ? ` · ${layerName(session.profile, layer)}` : '';
    this.tip.replaceChildren(
      h('b', {
        text: own === 0 ? t('key.empty') : own === 1 ? `▽ ${label}` : label || session.catalog.serialize(own),
      }),
      h('br'),
      h('code', { text: `${session.catalog.serialize(own)} · [${keyId(hit.row, hit.col)}]${extra}` }),
    );
    this.tip.hidden = false;
    const width = this.tip.offsetWidth;
    const height = this.tip.offsetHeight;
    let x = event.clientX + 16;
    let y = event.clientY + 18;
    if (x + width > innerWidth - 8) x = event.clientX - width - 12;
    if (y + height > innerHeight - 8) y = event.clientY - height - 12;
    this.tip.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }

  // ---------------------------------------------------------------------------------------------
  // Édition
  // ---------------------------------------------------------------------------------------------

  /** Message d'édition : région annoncée (lecteurs d'écran, tests) et pastille, avec Annuler si possible. */
  private editStatus(level: Level, message: string, undoable = false): void {
    this.editStatusEl.dataset.level = level;
    this.editStatusEl.textContent = message;
    const action: ToastAction | undefined =
      undoable && this.session?.editor.canUndo
        ? { label: t('edit.undo'), run: () => void this.travel('undo') }
        : undefined;
    this.toasts.show(message, level, action);
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
        this.editStatus('ok', t('edit.written', this.describe(position, result.stored)), true);
      }
    } catch (error) {
      this.editStatus('error', t('edit.error', { message: errorMessage(error) }));
    }
    this.refresh();
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
      this.editStatus('error', t('edit.error', { message: errorMessage(error) }));
    }
    this.refresh();
  }

  private entryName(change: Exclude<Change, KeyChange | { kind: 'leds' }>): string {
    if (change.kind === 'tapDance') return `TD(${String(change.index)})`;
    if (change.kind === 'combo') return t('dyn.comboName', { n: change.index });
    return `M${String(change.index)}`;
  }

  // ---------------------------------------------------------------------------------------------
  // Clavier de l'ordinateur : raccourcis, palette, miroir des frappes
  // ---------------------------------------------------------------------------------------------

  /** Arme la capture : la prochaine touche tapée (avec ses modificateurs) est affectée à la touche choisie. */
  private startCapture(): void {
    if (!this.session || !this.selected) return;
    this.capturing = true;
    this.keyCapture.reset();
    this.refresh();
    // le focus quitte le bouton : Espace ou Entrée sont capturés au lieu de le relancer
    this.ws?.keyHead.focus();
    this.glow(900);
  }

  private stopCapture(): void {
    if (!this.capturing) return;
    this.capturing = false;
    this.keyCapture.reset();
    if (this.ws && this.session) this.refresh();
  }

  /** La frappe va-t-elle à la capture ? Pas dans un champ de saisie, ni sous une feuille ou la palette. */
  private captures(event: KeyboardEvent): boolean {
    const target = event.target;
    return (
      this.capturing &&
      this.tab === 'keys' &&
      Boolean(this.selected) &&
      !this.palette.open &&
      !this.guide.open &&
      this.device.hidden &&
      !document.querySelector('dialog[open]') &&
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    );
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.captures(event)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        this.stopCapture();
        return;
      }
      if (event.repeat) return;
      const code = this.keyCapture.down(event.code, this.layout === 'azerty');
      if (code !== undefined) void this.assign(code);
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && key === 'k') {
      event.preventDefault();
      if (this.palette.open) this.palette.close();
      else this.palette.show();
      return;
    }
    if (this.palette.open) return;
    if (event.key === 'Escape') {
      if (this.guide.open) this.guide.close();
      if (!this.device.hidden) this.device.hidden = true;
      if (this.display.open) {
        this.display.toggle(false);
        this.displayButton.setAttribute('aria-expanded', 'false');
      }
    }
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      document.querySelector('dialog[open]')
    ) {
      return;
    }
    if (!this.session) return;
    if (mod && !event.altKey) {
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        void this.travel('undo');
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        void this.travel('redo');
      }
      return;
    }
    // pas de miroir des frappes sous une feuille ouverte (Espace y déplie les rubriques du guide)
    if (this.device.hidden && !this.guide.open) this.mirrorKey(event);
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (this.capturing) {
      // un modificateur appuyé puis relâché seul (Ctrl, Maj…) est affecté à son relâchement
      const code = this.keyCapture.up(event.code);
      if (code !== undefined && this.captures(event)) {
        event.preventDefault();
        void this.assign(code);
      }
    }
    const key = this.physical.get(event.code);
    if (!key) return;
    this.physical.delete(event.code);
    this.k3d?.release(key.row, key.col);
  }

  private commands(): Command[] {
    const session = this.session;
    const list: Command[] = [];
    if (session) {
      for (let layer = 0; layer < session.client.info.layers; layer++) {
        list.push({
          label: layerName(session.profile, layer),
          hint: t('palette.layer', { n: layer }),
          run: () => {
            this.setLayer(layer);
          },
        });
      }
      for (const [view, label] of VIEWS)
        list.push({
          label: t(label),
          hint: t('palette.view'),
          run: () => {
            this.setView(view);
          },
        });
      list.push(
        {
          label: t('palette.tabKeys'),
          hint: t('palette.tab'),
          run: () => {
            this.setTab('keys');
          },
        },
        {
          label: t('palette.tabLight'),
          hint: t('palette.tab'),
          run: () => {
            this.setTab('light');
          },
        },
        {
          label: t('palette.tabDynamic'),
          hint: t('palette.tab'),
          run: () => {
            this.setTab('dynamic');
          },
        },
        {
          label: t('palette.tabTry'),
          hint: t('palette.tab'),
          run: () => {
            this.setTab('try');
          },
        },
      );
      for (const [value, label] of [
        ['layer', 'led.layer'],
        ['live', 'led.live'],
        ['off', 'led.off'],
      ] as const) {
        list.push({
          label: t(label),
          hint: t('led.display'),
          run: () => {
            this.ledDisplay = value;
            saveLedDisplay(value);
            this.display.setLed(value);
            this.updatePreview();
            this.showLedState();
            this.paintPreview();
          },
        });
      }
      const rgb = session.rgb;
      if (rgb) {
        for (const id of session.client.info.rgb?.supportedEffects ?? []) {
          if (id === 0) continue;
          list.push({
            label: effectName(id),
            hint: t('palette.effect'),
            run: () => {
              rgb.update({ effect: id });
              this.colorPanelKey = '';
              this.refresh();
              this.toasts.show(t('palette.effectSet', { name: effectName(id) }));
            },
          });
        }
        list.push({
          label: rgb.mode.effect ? t('palette.lightOff') : t('palette.lightOn'),
          hint: 'RM_TOGG',
          run: () => {
            this.toggleLighting(rgb.mode.effect === 0);
          },
        });
      }
      list.push(
        { label: t('palette.undo'), hint: 'Ctrl Z', run: () => void this.travel('undo') },
        { label: t('palette.redo'), hint: 'Ctrl Maj Z', run: () => void this.travel('redo') },
        {
          label: t('palette.backup'),
          hint: t('view.backup'),
          run: () => {
            this.openScrim(this.device);
          },
        },
        {
          label: this.caseOn ? t('palette.caseOff') : t('palette.caseOn'),
          hint: t('display.case'),
          run: () => {
            this.caseOn = !this.caseOn;
            this.display.setCase(this.caseOn);
            this.k3d?.setCase(this.caseOn);
          },
        },
        {
          label: t('display.reset'),
          hint: t('display.geometry'),
          run: () => {
            this.display.resetSplit();
          },
        },
      );
    }
    list.push(
      { label: t('connect.button'), hint: 'WebHID', run: () => void this.connect() },
      { label: t('demo.button'), hint: t('pill.demo'), run: () => void this.startDemo() },
      {
        label: t('palette.display'),
        hint: t('display.title'),
        run: () => {
          this.display.toggle(true);
        },
      },
    );
    for (const topic of guideTopics())
      list.push({
        label: topic.title,
        hint: t('guide.title'),
        run: () => {
          this.guide.show(topic.id);
        },
      });
    return list;
  }
}
