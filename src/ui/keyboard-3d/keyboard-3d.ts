// Scène 3D du clavier (three.js), chargée à la demande : photo produit d'un split avec coque imprimée, PCB sérigraphié,
// switches, LED en direct, Pico, câble entre moitiés ; vues Produit, Dessus, Éclaté, Rayons X et pile des Couches.
// Rendu à la demande : une image n'est calculée que pendant une animation (caméra, transitions, appuis, LED…).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { KeyGeometry } from '../../keyboard/kle';
import type { Model3D } from '../../profiles';
import type { LedPaints } from '../../rgb/led-preview';
import { keyId, type KeyView } from '../keyboard-view';
import {
  chainOrder,
  fallbackOutline,
  matrixWires,
  offsetPolygon,
  outlineIndex,
  partKeys,
  placeKey,
  pointInPolygon,
  polygonBounds,
  rightEdge,
  rotatedSquare,
  sceneBounds,
  spreadApart,
  type Bounds,
  type KeyPlacement,
  type Point,
} from './geometry';
import { drawLegend, LEGEND_PX, legendKey } from './legend';
import { ledColor, legendColor, parseCssColor, type Rgb } from './led-color';
import { injectStyles } from './overlay';
import { boardTexture, PICO_SIZE, radialTexture, silkTexture, type SilkSpec } from './textures';

export type SceneView = 'product' | 'top' | 'exploded' | 'xray' | 'stack';
export type SceneMode = 'keys' | 'paint' | 'try';
export type PartName = 'caps' | 'switches' | 'leds' | 'case' | 'pcb' | 'sockets' | 'pico' | 'usb';

/** Pixels du canvas couverts par les panneaux : la caméra centre le clavier dans la zone restante. */
export interface SceneInsets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Géométrie du split : écartement en unités de touche, inclinaison et ouverture en degrés. */
export interface SplitGeometry {
  readonly gap: number;
  readonly tent: number;
  readonly splay: number;
}

export interface StackLayer {
  readonly views: readonly KeyView[];
  readonly paints: LedPaints;
  readonly tint: string;
  readonly name: string;
}

/** Touche sous le pointeur ; `layer` quand c'est une dalle de la pile des couches. */
export interface SceneHit {
  row: number;
  col: number;
  layer?: number;
}

export interface Keyboard3DOptions {
  readonly keys: readonly KeyGeometry[];
  readonly model?: Model3D | undefined;
  readonly text: {
    readonly canvas: string;
    readonly parts: Readonly<Record<PartName, readonly [title: string, sub: string]>>;
    /** Étiquette au-dessus de la moitié maître : « Droite · maître, branchée au PC ». */
    readonly halves: {
      readonly left: string;
      readonly right: string;
      readonly master: string;
      readonly masterLong: string;
    };
  };
  /** Mode keys : clic court sur une touche (jamais en mode paint : la peinture passe par onPaint*). */
  readonly onKeyClick: (row: number, col: number, event: MouseEvent) => void;
  /** Mode keys : clic court dans le vide. */
  readonly onBackgroundClick?: () => void;
  readonly onPaintStart?: (row: number, col: number, event: PointerEvent) => void;
  readonly onPaintEnter?: (row: number, col: number) => void;
  readonly onPaintEnd?: () => void;
  readonly onTryPress?: (row: number, col: number) => void;
  readonly onTryRelease?: (row: number, col: number) => void;
  readonly onHover?: (hit: SceneHit | undefined, event: PointerEvent) => void;
  /** Keycode glissé depuis l'inspecteur et lâché sur une touche. */
  readonly onDrop?: (row: number, col: number, data: DataTransfer) => void;
  /** Clic sur une étiquette de couche ou une dalle de la pile. */
  readonly onLayerPick?: (layer: number, key?: { row: number; col: number }) => void;
  /** Première image rendue. */
  readonly onReady?: () => void;
}

/** Moitié branchée au PC (maître) et lien série avec l'autre moitié. */
export interface SplitLink {
  readonly master: 'left' | 'right';
  readonly remote: boolean;
}

export interface Keyboard3DState {
  readonly views: readonly KeyView[];
  readonly selected: string | undefined;
  readonly layer: number;
  readonly mode: SceneMode;
}

// Dimensions en unités de touche (1U = 19,05 mm), repère d'une moitié : dessous du PCB à y = 0.
const PCB_TOP = 0.104;
const SW_H = 0.13;
const CAP_Y = PCB_TOP + 0.25;
const CAP_H = 0.2;
const SKIRT_H = 0.085;
const TRAVEL = 0.1;
const CASE_FLOOR = 0.16;
const CASE_TOP = 0.078;
const STACK_Y0 = 1.3;
const STACK_DY = 0.62;
const IDLE_ROTATE_S = 16;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface ViewSpec {
  readonly phi: number;
  readonly theta: number;
  /** Facteur de distance par rapport au cadrage exact. */
  readonly k: number;
  readonly ty: number;
  readonly tz: number;
}

const VIEWS: Record<SceneView, ViewSpec> = {
  product: { phi: 0.86, theta: 0, k: 0.9, ty: 0.2, tz: 0.35 },
  top: { phi: 0.045, theta: 0, k: 1.02, ty: 0, tz: 0.1 },
  exploded: { phi: 0.98, theta: -0.5, k: 0.62, ty: 0.75, tz: 0.2 },
  xray: { phi: 0.42, theta: 0.12, k: 0.98, ty: 0, tz: 0.2 },
  stack: { phi: 1.1, theta: 0.56, k: 1.2, ty: 2.7, tz: 0 },
};

type GroupName =
  'caps' | 'switches' | 'sockets' | 'pcb' | 'leds' | 'pico' | 'xray' | 'stack' | 'caseTop' | 'caseBot';
const GROUPS: readonly GroupName[] = [
  'caps',
  'switches',
  'sockets',
  'pcb',
  'leds',
  'pico',
  'xray',
  'stack',
  'caseTop',
  'caseBot',
];

type Board = NonNullable<Model3D['boards']>[number];
type Link = NonNullable<Model3D['links']>[number];
type Tube = THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;

interface Slab {
  readonly layer: number;
  readonly group: THREE.Group;
  readonly plate: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  readonly edge: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly solid: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly ghost: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly none: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  solidMap: string[];
  ghostMap: string[];
}

interface Half {
  readonly index: number;
  /** -1 moitié gauche, +1 moitié droite, 0 clavier d'un seul tenant. */
  readonly sign: number;
  readonly outline: readonly Point[];
  readonly bounds: Bounds;
  readonly root: THREE.Group;
  readonly splay: THREE.Group;
  readonly tent: THREE.Group;
  readonly content: THREE.Group;
  readonly groups: Record<GroupName, THREE.Group>;
  readonly keys: Key3D[];
  readonly swTop: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly chip: THREE.InstancedMesh;
  readonly glow: THREE.InstancedMesh;
  readonly contact: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly spill: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly rowTubes: { readonly row: number; readonly mesh: Tube }[];
  readonly colTubes: { readonly col: number; readonly mesh: Tube }[];
  readonly chain: { readonly uT: { value: number }; readonly uO: { value: number } } | undefined;
  readonly boards: readonly Board[];
  readonly link: Link | undefined;
  readonly linkAnchor: { readonly anchor: THREE.Object3D; readonly dir: THREE.Vector3 } | undefined;
  readonly silk: { readonly spec: SilkSpec; readonly material: THREE.MeshStandardMaterial };
  readonly plateGeo: THREE.ShapeGeometry;
  readonly edgeGeo: THREE.BufferGeometry;
  slabs: Slab[];
}

interface Key3D {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly place: KeyPlacement;
  readonly half: Half;
  /** Indice dans les maillages instanciés de la moitié (ordre de la chaîne LED). */
  readonly index: number;
  /** Rang global dans la chaîne LED (vagues de démarrage et de connexion). */
  readonly chain: number;
  readonly group: THREE.Group;
  readonly inner: THREE.Group;
  readonly capMat: THREE.MeshStandardMaterial;
  readonly skirtMat: THREE.MeshStandardMaterial;
  readonly legend: THREE.Mesh;
  readonly legendMat: THREE.MeshBasicMaterial;
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  shown: KeyView | undefined;
  sig: string;
  pending: { sig: string; view: KeyView } | undefined;
  flipAt: number | undefined;
  flipSwapped: boolean;
  /** Biais de mipmap de la légende (flou du changement de couche). */
  readonly blur: { value: number };
  /** 0 → 1 : moitié non reliée qui s'efface (touches translucides, LED éteintes) avant d'être masquée. */
  ghost: number;
  /** Couleur demandée (sRGB 0-1) et couleur affichée (linéaire, amortie). */
  rgb: Rgb;
  readonly led: THREE.Color;
  press: number;
  pressTarget: number;
  lift: number;
  flash: number;
  releaseTimer: number | undefined;
}

interface PartLabel {
  readonly anchor: THREE.Object3D;
  readonly el: HTMLDivElement;
  readonly line: SVGLineElement;
  readonly dot: SVGCircleElement;
}

interface HalfTag {
  readonly half: Half;
  readonly el: HTMLDivElement;
  readonly anchor: THREE.Object3D;
  sig: string;
}

interface StackLabel {
  readonly layer: number;
  readonly el: HTMLButtonElement;
  readonly name: Text;
  readonly anchor: THREE.Object3D;
}

interface Pick {
  readonly key: Key3D;
  readonly layer?: number;
}

// Flou de légende calculé sur le GPU : la texture est lue dans un niveau de mipmap plus grossier (biais uBlur),
// sans redessiner le canvas ni renvoyer la texture.
const BLUR_MAP_FRAGMENT = THREE.ShaderChunk.map_fragment.replace(
  'texture2D( map, vMapUv )',
  'texture2D( map, vMapUv, uBlur )',
);
/** Durée du fondu flou d'une légende (s). */
const LEGEND_SWAP_S = 0.34;

const now = (): number => performance.now() / 1000;
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const px = (n: number): string => `${n.toFixed(1)}px`;
const rad = (deg: number): number => (deg * Math.PI) / 180;

function roundedPath<T extends THREE.Path>(points: readonly Point[], radius: number, path: T): T {
  const n = points.length;
  points.forEach((c, i) => {
    const a = points[(i - 1 + n) % n] ?? c;
    const b = points[(i + 1) % n] ?? c;
    const l1 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const l2 = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
    const r = Math.min(radius, l1 / 2.2, l2 / 2.2);
    const p1: Point = [c[0] + ((a[0] - c[0]) / l1) * r, c[1] + ((a[1] - c[1]) / l1) * r];
    const p2: Point = [c[0] + ((b[0] - c[0]) / l2) * r, c[1] + ((b[1] - c[1]) / l2) * r];
    // repère de la forme : y vers le haut ; la rotation de l'extrusion le ramène sur l'axe z de la scène
    if (i === 0) path.moveTo(p1[0], -p1[1]);
    else path.lineTo(p1[0], -p1[1]);
    path.quadraticCurveTo(c[0], -c[1], p2[0], -p2[1]);
  });
  path.closePath();
  return path;
}

/** Extrusion d'une forme du plan de la disposition, couchée sur le sol puis montée à `y`. */
function extrude(shape: THREE.Shape, depth: number, y: number, bevel = 0): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y + bevel, 0);
  return geometry;
}

function tubeAlong(
  points: readonly THREE.Vector3[],
  radius: number,
  material: THREE.MeshBasicMaterial,
): Tube {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let n = 0; n < points.length - 1; n++) {
    const a = points[n];
    const b = points[n + 1];
    if (a && b) path.add(new THREE.LineCurve3(a, b));
  }
  return new THREE.Mesh(
    new THREE.TubeGeometry(path, Math.max(8, points.length * 12), radius, 6, false),
    material,
  );
}

/** Couleur sRGB assombrie (tranche du PCB). */
function shade(css: string, factor: number): THREE.Color {
  const [r, g, b] = parseCssColor(css) ?? [0.2, 0.2, 0.22];
  return new THREE.Color().setRGB(r * factor, g * factor, b * factor, THREE.SRGBColorSpace);
}

function visibleInScene(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export class Keyboard3D {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLDivElement;
  private readonly leaders: SVGSVGElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly world = new THREE.Group();
  private readonly halves: Half[];
  private readonly keys = new Map<string, Key3D>();
  private readonly capOwner = new Map<THREE.Object3D, Key3D>();
  private readonly tileOwner = new Map<THREE.Object3D, { slab: Slab; ghost: boolean }>();
  private readonly capMeshes: THREE.Mesh[] = [];
  private readonly bounds: Bounds;
  private readonly lights: {
    readonly hemi: THREE.HemisphereLight;
    readonly key: THREE.DirectionalLight;
    readonly rim: THREE.DirectionalLight;
  };
  private readonly shadow = new THREE.ShadowMaterial({ opacity: 0.12 });
  private readonly caseMat = new THREE.MeshStandardMaterial({
    color: '#151517',
    roughness: 0.93,
    metalness: 0,
    envMapIntensity: 0.2,
  });
  private readonly chipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  private readonly cableMat = new THREE.MeshStandardMaterial({ color: '#2C2C2E', roughness: 0.55 });
  private readonly glowTex = radialTexture([
    [0, 1],
    [0.25, 0.5],
    [0.6, 0.1],
    [1, 0],
  ]);
  private readonly softTex = radialTexture([
    [0, 1],
    [0.45, 0.55],
    [1, 0],
  ]);
  private readonly tileGeo = new RoundedBoxGeometry(1, 0.05, 1, 1, 0.02);
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();
  private readonly selectRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly dropRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly pulses: {
    readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    t0: number;
    duration: number;
    active: boolean;
  }[] = [];
  private readonly parts: PartLabel[] = [];
  private readonly halfTags: HalfTag[] = [];
  private stackLabels: StackLabel[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly themeObserver: MutationObserver;
  private readonly themeQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly tmp = new THREE.Color();
  private readonly tmp2 = new THREE.Color();
  private theme = { glow: 0.3, spill: 0, contact: 0.16 };

  private size = { width: 0, height: 0 };
  private insets: SceneInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  private view: SceneView = 'product';
  private mode: SceneMode = 'keys';
  private layer: number | undefined;
  private selected: string | undefined;
  private hover: string | undefined;
  private dropHover: string | undefined;
  private painting: string | undefined;
  private tryKey: string | undefined;
  private down: { x: number; y: number; hit: Pick | undefined; button: number } | undefined;
  private split: SplitGeometry = { gap: 3.5, tent: 0, splay: 0 };
  private readonly geo = { gap: 3.5, tent: 0, splay: 0 };
  private caseOn = true;
  private caseF = 1;
  private explodeF = 0;
  private xrayF = 0;
  private stackF = 0;
  /** 1 : les deux moitiés affichées ; 0 : la moitié non reliée est sortie du cadre et masquée. */
  private linkF = 1;
  private link: SplitLink | undefined;
  /** Moitié non reliée, gardée le temps qu'elle revienne dans le cadre. */
  private goneHalf: number | undefined;
  private xrayOn = false;
  private labelsShown = false;
  private stackCount = 0;
  private cable: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial> | undefined;
  private cableCurve: THREE.CatmullRomCurve3 | undefined;
  private cablesDirty = true;
  private tween:
    | {
        readonly t0: number;
        readonly duration: number;
        readonly from: THREE.Spherical;
        readonly to: THREE.Spherical;
        readonly fromTarget: THREE.Vector3;
        readonly target: THREE.Vector3;
      }
    | undefined;
  private userMoved = false;
  private started = false;
  private ready = false;
  private bootAt: number | undefined;
  private idleAt = now();
  private idleTimer: number | undefined;
  private frame = 0;
  private last = now();
  private activeUntil = 0;
  private disposed = false;

  constructor(private readonly options: Keyboard3DOptions) {
    injectStyles();
    this.element = document.createElement('div');
    this.element.className = 'keyboard-3d';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'k3d-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', options.text.canvas);
    this.overlay = document.createElement('div');
    this.overlay.className = 'k3d-overlay';
    this.leaders = document.createElementNS(SVG_NS, 'svg');
    this.leaders.classList.add('k3d-leaders');
    this.leaders.setAttribute('aria-hidden', 'true');
    this.overlay.append(this.leaders);
    this.element.append(this.canvas, this.overlay);

    const narrow = matchMedia('(max-width: 820px)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, narrow ? 1.75 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd6d6db, 0.7);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-5, 18, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048);
    Object.assign(key.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 2, far: 50 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(8, 6, -12);
    this.lights = { hemi, key, rim };
    this.scene.add(hemi, key, rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), this.shadow);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // tout est construit dans le repère de la disposition (x, z = y KLE), puis centré
    const model = options.model;
    const outlines = (model?.outlines.length ? [...model.outlines] : [fallbackOutline(options.keys)]).sort(
      (a, b) => {
        const ba = polygonBounds(a);
        const bb = polygonBounds(b);
        return ba.minX + ba.maxX - (bb.minX + bb.maxX);
      },
    );
    this.bounds = sceneBounds(options.keys, outlines);
    this.world.position.set(
      -(this.bounds.minX + this.bounds.maxX) / 2,
      0,
      -(this.bounds.minY + this.bounds.maxY) / 2,
    );
    this.scene.add(this.world);
    const byHalf = outlines.map((): KeyPlacement[] => []);
    for (const place of options.keys.map(placeKey))
      byHalf[outlineIndex(outlines, place.cx, place.cy)]?.push(place);
    let chain = 0;
    this.halves = outlines.map((outline, index) => {
      const half = this.buildHalf(index, outlines.length, outline, byHalf[index] ?? [], chain, model);
      chain += half.keys.length;
      return half;
    });

    const ringMat = (): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        toneMapped: false,
        depthWrite: false,
      });
    this.selectRing = new THREE.Mesh(this.ringGeometry(1, 1), ringMat());
    this.selectRing.material.opacity = 0.9;
    this.selectRing.visible = false;
    this.dropRing = new THREE.Mesh(this.ringGeometry(1, 1), ringMat());
    this.dropRing.visible = false;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), ringMat());
    this.beam.material.opacity = 0;
    this.beam.visible = false;
    const pulseGeo = new THREE.SphereGeometry(0.06, 12, 8);
    for (let n = 0; n < 16; n++) {
      const mesh = new THREE.Mesh(
        pulseGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.pulses.push({ mesh, t0: 0, duration: 1, active: false });
    }
    this.buildPartLabels();
    this.buildHalfTags();

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = 1.48;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 0.3;
    this.controls.addEventListener('change', () => {
      this.wake(0.1);
    });
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
      this.tween = undefined;
      this.touch();
    });
    this.bindPointer();

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.element);
    this.themeObserver = new MutationObserver(() => {
      this.applyTheme();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    this.themeQuery.addEventListener('change', this.onThemeChange);
    this.applyTheme();
    this.touch();
    // polices chargées après coup : légendes et sérigraphie redessinées
    void document.fonts.ready.then(() => {
      if (this.disposed) return;
      for (const key of this.keys.values()) if (key.shown) this.paintLegend(key, key.shown, key.sig);
      for (const half of this.halves) {
        const old = half.silk.material.map;
        half.silk.material.map = silkTexture(half.silk.spec);
        half.silk.material.needsUpdate = true;
        old?.dispose();
      }
      this.wake(0.1);
    });
  }

  /** WebGL 2 disponible ? Sinon l'application garde le dessin en plan. */
  static supported(): boolean {
    try {
      return Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------ API

  /** Légendes, touche choisie, couche et mode ; un changement de couche floute puis remplace les légendes. */
  setState({ views, selected, layer, mode }: Keyboard3DState): void {
    const t = now();
    this.layer = layer;
    for (const view of views) {
      const key = this.keys.get(keyId(view.geometry.row, view.geometry.col));
      if (!key) continue;
      const sig = legendKey(view.label, view.kind);
      if (key.sig === '') {
        this.paintLegend(key, view, sig);
        continue;
      }
      if (key.pending?.sig === sig) {
        key.pending.view = view;
        continue;
      }
      if (!key.pending && sig === key.sig) continue;
      key.pending = { sig, view };
      key.flipSwapped = false;
      key.flipAt = t;
    }
    if (mode !== this.mode) {
      if (this.tryKey) this.releaseTry();
      this.painting = undefined;
      this.mode = mode;
      this.canvas.classList.toggle('is-paint', mode === 'paint');
      if (!this.tween) this.controls.enabled = true;
    }
    if (selected !== this.selected) {
      this.selected = selected;
      this.attachRing(this.selectRing, selected ? this.keys.get(selected) : undefined);
      if (selected) this.touch();
    }
    this.wake(0.6);
  }

  /** Couleurs des LED (aperçu en direct ou couleurs de la couche) ; les touches absentes s'éteignent. */
  setPaints(paints: LedPaints): void {
    for (const key of this.keys.values()) key.rgb = ledColor(paints.get(key.id));
    this.wake(0.6);
  }

  /** Données de la pile des couches : touches assignées (couleur de la LED ou teinte), transparentes, vides. */
  setStack(layers: readonly StackLayer[]): void {
    if (layers.length !== this.stackCount) this.rebuildStack(layers.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    layers.forEach((data, L) => {
      const label = this.stackLabels[L];
      if (label) {
        label.el.style.setProperty('--tint', data.tint);
        label.name.data = data.name;
        label.el.title = data.name;
      }
      const tint = new THREE.Color(data.tint);
      const kinds = new Map(data.views.map((v) => [keyId(v.geometry.row, v.geometry.col), v.kind]));
      for (const half of this.halves) {
        const slab = half.slabs[L];
        if (!slab) continue;
        slab.plate.material.color.copy(tint);
        slab.edge.material.color.copy(tint);
        slab.ghost.material.color.copy(tint);
        let a = 0;
        let b = 0;
        let c = 0;
        slab.solidMap = [];
        slab.ghostMap = [];
        for (const key of half.keys) {
          dummy.position.set(key.place.cx, 0, key.place.cy);
          dummy.rotation.set(0, -rad(key.place.angle), 0);
          dummy.scale.set(key.place.w * 0.9 - 0.02, 1, key.place.h * 0.9 - 0.02);
          dummy.updateMatrix();
          const kind = kinds.get(key.id) ?? 'none';
          if (kind === 'transparent') {
            slab.ghost.setMatrixAt(b, dummy.matrix);
            slab.ghostMap[b++] = key.id;
          } else if (kind === 'none') {
            slab.none.setMatrixAt(c++, dummy.matrix);
          } else {
            const paint = data.paints.get(key.id);
            const [r, g, bl] = ledColor(paint);
            if (paint?.kind === 'on' && r + g + bl > 0.01) color.setRGB(r, g, bl, THREE.SRGBColorSpace);
            else color.copy(tint);
            slab.solid.setMatrixAt(a, dummy.matrix);
            slab.solid.setColorAt(a, color);
            slab.solidMap[a++] = key.id;
          }
        }
        slab.solid.count = a;
        slab.ghost.count = b;
        slab.none.count = c;
        for (const mesh of [slab.solid, slab.ghost, slab.none]) {
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.boundingSphere = null;
        }
      }
    });
    this.wake(0.3);
  }

  /** Vol de caméra vers une vue et transitions (éclaté, rayons X, pile). */
  setView(view: SceneView): void {
    this.view = view;
    if (this.started) this.flyTo(view, 1.15);
    this.touch();
    this.wake(0.3);
  }

  setInsets(insets: SceneInsets): void {
    const same =
      insets.left === this.insets.left &&
      insets.right === this.insets.right &&
      insets.top === this.insets.top &&
      insets.bottom === this.insets.bottom;
    if (same) return;
    this.insets = { ...insets };
    this.applyViewOffset();
    if (this.started && !this.userMoved && !this.tween) this.snapTo(this.view);
    this.wake(0.2);
  }

  setSplit(geometry: SplitGeometry): void {
    this.split = { ...geometry };
    this.wake(1.5);
  }

  setCase(visible: boolean): void {
    this.caseOn = visible;
    this.wake(1.5);
  }

  /** Appui visuel (frappe physique miroir) ; relâché automatiquement après 1 s sans `release`. */
  press(row: number, col: number): void {
    const key = this.keys.get(keyId(row, col));
    if (!key) return;
    this.pressVisual(key);
    window.clearTimeout(key.releaseTimer);
    key.releaseTimer = window.setTimeout(() => {
      key.pressTarget = 0;
      this.wake(0.4);
    }, 1000);
  }

  release(row: number, col: number): void {
    const key = this.keys.get(keyId(row, col));
    if (!key) return;
    window.clearTimeout(key.releaseTimer);
    key.releaseTimer = undefined;
    key.pressTarget = 0;
    this.wake(0.4);
  }

  /** Vague lumineuse le long de la chaîne LED (connexion). */
  /** Moitié branchée au PC et lien avec l'autre (undefined : inconnu, rien d'affiché). */
  setLink(link: SplitLink | undefined): void {
    if (link?.master === this.link?.master && link?.remote === this.link?.remote) return;
    const before = this.absentHalf();
    this.link = link ? { ...link } : undefined;
    if (this.absentHalf() !== before && this.started && !this.userMoved) this.flyTo(this.view, 0.9);
    this.wake(1.2);
  }

  /** La touche est-elle sur la moitié non reliée (masquée) ? */
  isAbsent(row: number, col: number): boolean {
    const absent = this.absentHalf();
    return absent !== undefined && this.keys.get(keyId(row, col))?.half.index === absent;
  }

  flash(): void {
    for (const key of this.keys.values()) key.flash = Math.max(key.flash, 0.7 - key.chain * 0.01);
    this.wake(1);
  }

  /**
   * Centre du dessus d'une keycap en coordonnées client (comme clientX/clientY), d'après la caméra courante ;
   * undefined si la touche n'existe pas ou n'est pas visible (moitié gauche masquée en vue éclatée).
   */
  screenPoint(row: number, col: number): { x: number; y: number } | undefined {
    const key = this.keys.get(keyId(row, col));
    if (!key || !visibleInScene(key.inner) || this.size.width < 2) return undefined;
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    const p = key.inner.localToWorld(new THREE.Vector3(0, CAP_Y + CAP_H, 0)).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.idleTimer);
    for (const key of this.keys.values()) window.clearTimeout(key.releaseTimer);
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
    this.themeQuery.removeEventListener('change', this.onThemeChange);
    this.controls.dispose();
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>(this.geometryCache.values());
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      const { geometry, material } = object as THREE.Mesh | THREE.Line;
      geometries.add(geometry);
      for (const m of Array.isArray(material) ? material : [material]) materials.add(m);
    });
    for (const half of this.halves) {
      geometries.add(half.plateGeo).add(half.edgeGeo);
    }
    geometries.add(this.tileGeo);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
    this.glowTex.dispose();
    this.softTex.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.element.remove();
  }

  // ------------------------------------------------------------------ construction

  private buildHalf(
    index: number,
    count: number,
    outline: readonly Point[],
    placements: readonly KeyPlacement[],
    chainBase: number,
    model: Model3D | undefined,
  ): Half {
    const sign = count === 1 ? 0 : index === 0 ? -1 : 1;
    const side = sign < 0 ? -1 : 1;
    const bounds = polygonBounds(outline);
    const ordered = chainOrder(placements);
    const inside = (x: number, y: number): boolean => pointInPolygon(outline, x, y);
    const boards = (model?.boards ?? []).filter((b) => inside(b.x, b.y));
    const link = (model?.links ?? []).find((l) => inside(l.edge - l.out * 0.2, l.y));
    const holes = (model?.holes ?? []).filter(([x, y]) => inside(x, y));
    const texts = (model?.silk ?? []).filter((s) => inside(s.x, s.y));

    // pivots : écartement depuis le centre, inclinaison autour du bord extérieur, ouverture autour du coin intérieur bas
    const root = new THREE.Group();
    const splay = new THREE.Group();
    const tent = new THREE.Group();
    const content = new THREE.Group();
    root.add(splay);
    splay.add(tent);
    tent.add(content);
    this.world.add(root);
    const outerX = sign < 0 ? bounds.minX : bounds.maxX;
    const pivotX = sign < 0 ? bounds.maxX : bounds.minX;
    const pivotZ = bounds.minY + (bounds.maxY - bounds.minY) * 0.85;
    splay.position.set(pivotX, 0, pivotZ);
    tent.position.set(outerX - pivotX, 0, -pivotZ);
    content.position.set(-outerX, 0, 0);
    const groups = Object.fromEntries(GROUPS.map((name) => [name, new THREE.Group()])) as Record<
      GroupName,
      THREE.Group
    >;
    for (const group of Object.values(groups)) content.add(group);

    // PCB sérigraphié
    const wires = matrixWires(ordered, side);
    const pcbColor = model?.pcbColor ?? '#2a2a2e';
    const spec: SilkSpec = {
      outline,
      color: pcbColor,
      keys: ordered.map((p, i) => ({ cx: p.cx, cy: p.cy, angle: p.angle, ch: i + 1 })),
      wires: [...wires.rows.map((w) => w.points), ...wires.cols.map((w) => w.points)],
      boards: boards.map((b): Point => [b.x, b.y]),
      pads: link ? [[link.edge - link.out * 0.19, link.y]] : [],
      holes,
      texts,
    };
    const silkMat = new THREE.MeshStandardMaterial({
      map: silkTexture(spec),
      roughness: 0.55,
      metalness: 0.04,
      envMapIntensity: 0.6,
    });
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, -y)));
    const pcbGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.084,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.012,
      bevelSegments: 1,
      curveSegments: 2,
    });
    pcbGeo.rotateX(-Math.PI / 2);
    pcbGeo.translate(0, 0.01, 0);
    const pcb = new THREE.Mesh(pcbGeo, [
      silkMat,
      new THREE.MeshStandardMaterial({ color: shade(pcbColor, 0.8), roughness: 0.7 }),
    ]);
    pcb.castShadow = true;
    pcb.receiveShadow = true;
    groups.pcb.add(pcb);

    // ombre de contact et reflet coloré des LED sur le bureau
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxY - bounds.minY;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minY + bounds.maxY) / 2 + 0.05;
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 3, d + 2.4),
      new THREE.MeshBasicMaterial({
        map: this.softTex,
        transparent: true,
        depthWrite: false,
        color: 0x000000,
        opacity: 0.2,
      }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(cx, 0.002, cz);
    const spill = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 4, d + 3.4),
      new THREE.MeshBasicMaterial({
        map: this.softTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        color: 0x000000,
      }),
    );
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(cx, 0.003, cz);
    content.add(contact, spill);

    // switches, sockets hot-swap, puces LED et halos
    const n = ordered.length;
    const swBot = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.74, SW_H * 0.5, 0.74),
      new THREE.MeshStandardMaterial({ color: '#1C1C1E', roughness: 0.6 }),
      n,
    );
    const swTop = new THREE.InstancedMesh(
      new RoundedBoxGeometry(0.66, SW_H * 0.55, 0.66, 2, 0.025),
      new THREE.MeshStandardMaterial({ color: '#F2F2F7', roughness: 0.3, transparent: true, opacity: 0.6 }),
      n,
    );
    const stem = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.07),
      new THREE.MeshStandardMaterial({ color: '#E5E5EA', roughness: 0.5 }),
      n,
    );
    const sock = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.62, 0.07, 0.42),
      new THREE.MeshStandardMaterial({ color: '#1C1C1E', roughness: 0.55 }),
      n,
    );
    const chip = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.045, 0.1), this.chipMat, n);
    const glowGeo = new THREE.PlaneGeometry(1.45, 1.45);
    glowGeo.rotateX(-Math.PI / 2);
    const glow = new THREE.InstancedMesh(
      glowGeo,
      new THREE.MeshBasicMaterial({
        map: this.glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      n,
    );
    const dummy = new THREE.Object3D();
    const place = (
      mesh: THREE.InstancedMesh,
      j: number,
      p: KeyPlacement,
      x: number,
      y: number,
      z: number,
    ): void => {
      dummy.position.set(p.cx, y, p.cy);
      dummy.rotation.set(0, -rad(p.angle), 0);
      dummy.translateX(x);
      dummy.translateZ(z);
      dummy.updateMatrix();
      mesh.setMatrixAt(j, dummy.matrix);
    };
    const black = new THREE.Color(0, 0, 0);
    ordered.forEach((p, j) => {
      place(swBot, j, p, 0, PCB_TOP + SW_H * 0.25, 0);
      place(swTop, j, p, 0, PCB_TOP + SW_H * 0.775, 0);
      place(stem, j, p, 0, PCB_TOP + SW_H + 0.05, 0);
      place(sock, j, p, -0.05, -0.035, 0.12);
      place(chip, j, p, 0, PCB_TOP + 0.0225, -0.29);
      place(glow, j, p, 0, PCB_TOP + 0.004, -0.12);
      chip.setColorAt(j, black);
      glow.setColorAt(j, black);
    });
    for (const mesh of [swBot, swTop, stem]) mesh.castShadow = true;
    groups.switches.add(swBot, swTop, stem);
    groups.sockets.add(sock);
    groups.leds.add(chip, glow);

    // rayons X : fils de la matrice et chaîne LED animée depuis le microcontrôleur
    const xy = PCB_TOP + 0.015;
    const tubeMat = (color: string): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      });
    const rowTubes = wires.rows
      .filter((wire) => wire.points.length > 1)
      .map((wire) => ({
        row: wire.row,
        mesh: tubeAlong(
          wire.points.map(([x, y]) => new THREE.Vector3(x, xy, y)),
          0.018,
          tubeMat('#FFD60A'),
        ),
      }));
    const colTubes = wires.cols
      .filter((wire) => wire.points.length > 1)
      .map((wire) => ({
        col: wire.col,
        mesh: tubeAlong(
          wire.points.map(([x, y]) => new THREE.Vector3(x, xy + 0.01, y)),
          0.018,
          tubeMat('#64D2FF'),
        ),
      }));
    for (const tube of [...rowTubes, ...colTubes]) groups.xray.add(tube.mesh);
    const firstBoard = boards[0];
    const chainPoints = [
      ...(firstBoard ? [new THREE.Vector3(firstBoard.x, xy, firstBoard.y + 1.2)] : []),
      ...ordered.map((p) => {
        const a = -rad(p.angle);
        return new THREE.Vector3(p.cx - Math.sin(a) * 0.29, xy + 0.02, p.cy - Math.cos(a) * 0.29);
      }),
    ];
    let chainUniforms: Half['chain'];
    if (chainPoints.length > 1) {
      const uniforms = {
        uT: { value: 0 },
        uO: { value: 0 },
        uC: { value: new THREE.Color('#FF4FA0') },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader:
          'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform float uT; uniform float uO; uniform vec3 uC; varying vec2 vUv; void main(){ float f = fract(vUv.x * 14.0 - uT * 0.8); float p = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.05, 0.3, f)); vec3 col = mix(uC * 0.4, uC * 1.6, p); gl_FragColor = vec4(col, uO * (0.35 + 0.65 * p)); }',
        transparent: true,
        depthWrite: false,
      });
      groups.xray.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(chainPoints, false, 'centripetal'),
            420,
            0.016,
            6,
            false,
          ),
          material,
        ),
      );
      chainUniforms = { uT: uniforms.uT, uO: uniforms.uO };
    }
    groups.xray.visible = false;

    // pile des couches : contour de la carte, dalles construites par setStack
    const plateGeo = new THREE.ShapeGeometry(
      new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, -y))),
    );
    plateGeo.rotateX(-Math.PI / 2);
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(
      outline.map(([x, y]) => new THREE.Vector3(x, 0, y)),
    );
    groups.stack.visible = false;

    // Pico et connecteurs
    const headerMat = new THREE.MeshStandardMaterial({ color: '#1C1C1E', roughness: 0.6 });
    for (const board of boards) {
      const pico = this.picoMesh(board.label, board.wireless ?? false);
      pico.position.set(board.x, PCB_TOP + 0.12, board.y);
      groups.pico.add(pico);
      for (const s of [-1, 1]) {
        const header = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 2.55), headerMat);
        header.position.set(board.x + s * 0.48, PCB_TOP + 0.06, board.y);
        header.castShadow = true;
        groups.pico.add(header);
      }
    }
    let linkAnchor: Half['linkAnchor'];
    if (link) {
      const plug = new THREE.Mesh(
        new RoundedBoxGeometry(0.5, 0.2, 0.34, 2, 0.06),
        new THREE.MeshStandardMaterial({ color: '#2C2C2E', roughness: 0.4, metalness: 0.15 }),
      );
      plug.position.set(link.edge + link.out * 0.22, 0.1, link.y);
      plug.castShadow = true;
      const anchor = new THREE.Object3D();
      anchor.position.set(link.edge + link.out * 0.47, 0.1, link.y);
      content.add(plug, anchor);
      linkAnchor = { anchor, dir: new THREE.Vector3(link.out, 0, 0) };
    }

    const half: Half = {
      index,
      sign,
      outline,
      bounds,
      root,
      splay,
      tent,
      content,
      groups,
      keys: [],
      swTop,
      chip,
      glow,
      contact,
      spill,
      rowTubes,
      colTubes,
      chain: chainUniforms,
      boards,
      link,
      linkAnchor,
      silk: { spec, material: silkMat },
      plateGeo,
      edgeGeo,
      slabs: [],
    };
    const lastRow = Math.max(...ordered.map((p) => p.row));
    ordered.forEach((p, j) => {
      half.keys.push(this.buildKey(half, p, j, chainBase + j, p.row === lastRow));
    });
    this.buildCase(half, ordered);
    return half;
  }

  /** Coque imprimée noir mat au contour exact du PCB : bac dessous (cache les sockets) et dessus percé pour les switchs. */
  private buildCase(half: Half, placements: readonly KeyPlacement[]): void {
    const pts = half.outline;
    const floor = extrude(roundedPath(pts, 0.05, new THREE.Shape()), CASE_FLOOR - 0.07, -CASE_FLOOR);
    const wallShape = roundedPath(pts, 0.05, new THREE.Shape());
    wallShape.holes.push(roundedPath(offsetPolygon(pts, -0.08), 0.03, new THREE.Path()));
    const wall = extrude(wallShape, 0.07, -0.07);
    const topShape = roundedPath(pts, 0.05, new THREE.Shape());
    for (const p of placements)
      topShape.holes.push(roundedPath(rotatedSquare(p, 0.38), 0.06, new THREE.Path()));
    const top = extrude(topShape, CASE_TOP, PCB_TOP, 0.005);
    for (const [geometry, group] of [
      [floor, half.groups.caseBot],
      [wall, half.groups.caseBot],
      [top, half.groups.caseTop],
    ] as const) {
      const mesh = new THREE.Mesh(geometry, this.caseMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  private picoMesh(label: string, wireless: boolean): THREE.Group {
    const side = new THREE.MeshStandardMaterial({ color: '#17542F', roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({ map: boardTexture(label, wireless), roughness: 0.5 });
    const group = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(PICO_SIZE.w, 0.05, PICO_SIZE.d), [
      side,
      side,
      top,
      side,
      side,
      side,
    ]);
    board.castShadow = true;
    const usb = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ color: '#8E8E93', metalness: 0.5, roughness: 0.5 }),
    );
    usb.position.set(0, 0.095, -PICO_SIZE.d / 2 + 0.12);
    group.add(board, usb);
    return group;
  }

  private cached<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
    const existing = this.geometryCache.get(key);
    if (existing) return existing as T;
    const geometry = build();
    this.geometryCache.set(key, geometry);
    return geometry;
  }

  private buildKey(half: Half, place: KeyPlacement, index: number, chain: number, thumb: boolean): Key3D {
    const id = keyId(place.row, place.col);
    const group = new THREE.Group();
    group.position.set(place.cx, 0, place.cy);
    group.rotation.y = -rad(place.angle);
    const inner = new THREE.Group();
    group.add(inner);
    const { w, h } = place;
    const mod = w > 1.25 || h > 1.25 || thumb;
    const capMat = new THREE.MeshStandardMaterial({
      color: mod ? '#2D2D31' : '#232326',
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: 0.25,
    });
    const cap = new THREE.Mesh(
      this.cached(`cap:${String(w)}:${String(h)}`, () => {
        const geometry = new RoundedBoxGeometry(w - 0.07, CAP_H, h - 0.07, 3, 0.055);
        const position = geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) {
          const y = position.getY(i);
          const taper = 1 - 0.085 * ((y + CAP_H / 2) / CAP_H);
          position.setXYZ(i, position.getX(i) * taper, y + CAP_H / 2, position.getZ(i) * taper);
        }
        return geometry;
      }),
      capMat,
    );
    cap.position.y = CAP_Y;
    cap.castShadow = true;
    cap.receiveShadow = true;
    const skirtMat = new THREE.MeshStandardMaterial({
      color: '#141416',
      emissive: 0x000000,
      emissiveIntensity: 1,
      roughness: 0.6,
      transparent: true,
      opacity: 0.94,
      toneMapped: false,
    });
    const skirt = new THREE.Mesh(
      this.cached(`skirt:${String(w)}:${String(h)}`, () => {
        const geometry = new RoundedBoxGeometry(w - 0.055, SKIRT_H, h - 0.055, 2, 0.035);
        geometry.translate(0, SKIRT_H / 2 - 0.004, 0);
        return geometry;
      }),
      skirtMat,
    );
    skirt.position.y = CAP_Y;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(LEGEND_PX * w);
    canvas.height = Math.round(LEGEND_PX * h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const legendMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const blur = { value: 0 };
    legendMat.onBeforeCompile = (shader) => {
      shader.uniforms.uBlur = blur;
      shader.fragmentShader = `uniform float uBlur;\n${shader.fragmentShader.replace('#include <map_fragment>', BLUR_MAP_FRAGMENT)}`;
    };
    const legend = new THREE.Mesh(
      this.cached(`legend:${String(w)}:${String(h)}`, () => {
        const geometry = new THREE.PlaneGeometry((w - 0.07) * 0.915 - 0.07, (h - 0.07) * 0.915 - 0.07);
        geometry.rotateX(-Math.PI / 2);
        return geometry;
      }),
      legendMat,
    );
    legend.position.y = CAP_Y + CAP_H + 0.003;
    inner.add(skirt, cap, legend);
    half.groups.caps.add(group);
    const key: Key3D = {
      id,
      row: place.row,
      col: place.col,
      place,
      half,
      index,
      chain,
      group,
      inner,
      capMat,
      skirtMat,
      legend,
      legendMat,
      canvas,
      texture,
      shown: undefined,
      sig: '',
      pending: undefined,
      flipAt: undefined,
      flipSwapped: false,
      blur,
      ghost: 0,
      rgb: [0, 0, 0],
      led: new THREE.Color(0, 0, 0),
      press: 0,
      pressTarget: 0,
      lift: 0,
      flash: 0,
      releaseTimer: undefined,
    };
    this.keys.set(id, key);
    this.capMeshes.push(cap, skirt);
    this.capOwner.set(cap, key).set(skirt, key);
    return key;
  }

  private ringGeometry(w: number, h: number): THREE.BufferGeometry {
    return this.cached(`ring:${String(w)}:${String(h)}`, () => {
      const rect = (W: number, D: number): Point[] => [
        [-W / 2, -D / 2],
        [W / 2, -D / 2],
        [W / 2, D / 2],
        [-W / 2, D / 2],
      ];
      const outer = roundedPath(rect(w + 0.05, h + 0.05), 0.14, new THREE.Shape());
      outer.holes.push(roundedPath(rect(w - 0.01, h - 0.01), 0.11, new THREE.Path()));
      const geometry = new THREE.ShapeGeometry(outer, 6);
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    });
  }

  private attachRing(ring: THREE.Mesh, key: Key3D | undefined): void {
    if (!key) {
      ring.removeFromParent();
      ring.visible = false;
    } else {
      ring.geometry = this.ringGeometry(key.place.w, key.place.h);
      key.group.add(ring);
      ring.visible = true;
    }
    this.wake(0.2);
  }

  private rebuildStack(count: number): void {
    for (const half of this.halves) {
      for (const slab of half.slabs) {
        slab.group.removeFromParent();
        for (const mesh of [slab.plate, slab.edge, slab.solid, slab.ghost, slab.none]) {
          this.tileOwner.delete(mesh);
          mesh.material.dispose();
        }
      }
      const n = half.keys.length;
      half.slabs = Array.from({ length: count }, (_, layer): Slab => {
        const group = new THREE.Group();
        const plate = new THREE.Mesh(
          half.plateGeo,
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        const edge = new THREE.LineLoop(
          half.edgeGeo,
          new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }),
        );
        const solid = new THREE.InstancedMesh(
          this.tileGeo,
          new THREE.MeshStandardMaterial({ roughness: 0.35, transparent: true, opacity: 0 }),
          n,
        );
        solid.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3);
        const ghost = new THREE.InstancedMesh(
          this.tileGeo,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
          n,
        );
        const none = new THREE.InstancedMesh(
          this.tileGeo,
          new THREE.MeshStandardMaterial({ color: '#3A3A3C', transparent: true, opacity: 0 }),
          n,
        );
        for (const mesh of [solid, ghost, none]) {
          mesh.frustumCulled = false;
          mesh.count = 0;
        }
        group.add(plate, edge, solid, ghost, none);
        half.groups.stack.add(group);
        const slab: Slab = { layer, group, plate, edge, solid, ghost, none, solidMap: [], ghostMap: [] };
        this.tileOwner.set(solid, { slab, ghost: false }).set(ghost, { slab, ghost: true });
        return slab;
      });
    }
    for (const label of this.stackLabels) {
      label.el.remove();
      label.anchor.removeFromParent();
    }
    const host = this.halves[0]?.groups.stack;
    this.stackLabels = host
      ? Array.from({ length: count }, (_, layer): StackLabel => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'k3d-slabel';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.tabIndex = -1;
          const name = document.createTextNode(String(layer));
          el.append(document.createElement('i'), name);
          el.addEventListener('click', () => {
            this.options.onLayerPick?.(layer);
          });
          this.overlay.append(el);
          const anchor = new THREE.Object3D();
          host.add(anchor);
          return { layer, el, name, anchor };
        })
      : [];
    this.stackCount = count;
  }

  private buildPartLabels(): void {
    const half = this.halves[this.halves.length - 1];
    if (!half) return;
    const keys = partKeys(half.keys.map((k) => k.place));
    if (!keys) return;
    const edge = rightEdge(half.outline);
    const specs: [PartName, GroupName | null, [number, number, number]][] = [
      ['caps', 'caps', [keys.caps.cx, CAP_Y + CAP_H, keys.caps.cy]],
      ['switches', 'switches', [keys.switches.cx + 0.3, PCB_TOP + SW_H, keys.switches.cy]],
      ['leds', 'leds', [keys.leds.cx, PCB_TOP + 0.05, keys.leds.cy - 0.29]],
      ['case', 'caseTop', [edge.x - 0.36, PCB_TOP + CASE_TOP, edge.bottom - 0.008]],
      ['pcb', 'pcb', [edge.x - 0.11, 0.06, (edge.top + edge.bottom) / 2]],
      ['sockets', 'sockets', [keys.sockets.cx, -0.07, keys.sockets.cy + 0.12]],
    ];
    const board = half.boards[0];
    if (board) specs.push(['pico', 'pico', [board.x, PCB_TOP + 0.2, board.y - 0.4]]);
    if (half.link) specs.push(['usb', null, [half.link.edge + half.link.out * 0.3, 0.12, half.link.y]]);
    for (const [name, group, [x, y, z]] of specs) {
      const [title, sub] = this.options.text.parts[name];
      const el = document.createElement('div');
      el.className = 'k3d-plabel';
      el.style.opacity = '0';
      const b = document.createElement('b');
      b.textContent = title;
      const span = document.createElement('span');
      span.textContent = sub;
      el.append(b, span);
      this.overlay.append(el);
      const line = document.createElementNS(SVG_NS, 'line');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '2.5');
      this.leaders.append(line, dot);
      const anchor = new THREE.Object3D();
      anchor.position.set(x, y, z);
      (group ? half.groups[group] : half.content).add(anchor);
      this.parts.push({ anchor, el, line, dot });
    }
  }

  private buildHalfTags(): void {
    if (this.halves.length < 2) return;
    for (const half of this.halves) {
      if (!half.keys.length) continue;
      const xs = half.keys.map((k) => k.place.cx);
      const ys = half.keys.map((k) => k.place.cy);
      const el = document.createElement('div');
      el.className = 'k3d-htag';
      el.style.opacity = '0';
      this.overlay.append(el);
      const anchor = new THREE.Object3D();
      anchor.position.set(
        (Math.min(...xs) + Math.max(...xs)) / 2,
        PCB_TOP + CASE_TOP + 0.3,
        Math.min(...ys) - 0.9,
      );
      half.content.add(anchor);
      this.halfTags.push({ half, el, anchor, sig: '' });
    }
  }

  /** Moitié non reliée au maître (undefined : les deux répondent, ou lien inconnu). */
  private absentHalf(): number | undefined {
    const link = this.link;
    if (!link || link.remote || this.halves.length < 2) return undefined;
    return this.halves.find((h) => h.sign < 0 !== (link.master === 'left'))?.index;
  }

  private updateHalfTags(): void {
    const link = this.link;
    const text = this.options.text.halves;
    const show = this.explodeF < 0.3 && this.stackF < 0.3;
    const width = this.overlay.clientWidth;
    for (const tag of this.halfTags) {
      const left = tag.half.sign < 0;
      const master = link?.master === (left ? 'left' : 'right');
      const on = show && master;
      const opacity = on ? '1' : '0';
      if (tag.el.style.opacity !== opacity) tag.el.style.opacity = opacity;
      if (!on) continue;
      const sig = left ? 'l' : 'r';
      if (tag.sig !== sig) {
        const name = document.createElement('b');
        name.textContent = left ? text.left : text.right;
        // « · maître » et sa suite dans un même élément : pas d'espace de flex avant la virgule
        const state = document.createElement('span');
        state.textContent = `· ${text.master}`;
        const long = document.createElement('span');
        long.className = 'long';
        long.textContent = text.masterLong;
        state.append(long);
        tag.el.replaceChildren(document.createElement('i'), name, state);
        tag.sig = sig;
      }
      tag.el.classList.toggle('warn', left);
      const p = this.toScreen(tag.anchor);
      const w = tag.el.offsetWidth;
      const x = clamp(p.x, w / 2 + 12, Math.max(w / 2 + 12, width - w / 2 - 12));
      tag.el.style.transform = `translate(${px(x)}, ${px(p.y)}) translate(-50%, -100%)`;
    }
  }

  private paintLegend(key: Key3D, view: KeyView, sig: string): void {
    drawLegend(key.canvas, view.label, view.kind);
    key.texture.needsUpdate = true;
    key.sig = sig;
    key.shown = view;
  }

  // ------------------------------------------------------------------ interactions

  private pick(clientX: number, clientY: number): Pick | undefined {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return undefined;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.view === 'stack' && this.stackF > 0.5) {
      const tiles = this.halves.flatMap((h) => h.slabs.flatMap((s) => [s.solid, s.ghost]));
      for (const hit of this.raycaster.intersectObjects(tiles, false)) {
        const owner = this.tileOwner.get(hit.object);
        if (!owner || hit.instanceId === undefined || !visibleInScene(hit.object)) continue;
        const id = (owner.ghost ? owner.slab.ghostMap : owner.slab.solidMap)[hit.instanceId];
        const key = id === undefined ? undefined : this.keys.get(id);
        if (key) return { key, layer: owner.slab.layer };
      }
    }
    for (const hit of this.raycaster.intersectObjects(this.capMeshes, false)) {
      const key = this.capOwner.get(hit.object);
      if (key && visibleInScene(hit.object)) return { key };
    }
    return undefined;
  }

  private sceneHit(hit: Pick): SceneHit {
    return {
      row: hit.key.row,
      col: hit.key.col,
      ...(hit.layer === undefined ? {} : { layer: hit.layer }),
    };
  }

  /** Petite pression visuelle (peinture), relâchée seule. */
  private tap(key: Key3D, seconds: number): void {
    key.pressTarget = 1;
    window.setTimeout(() => {
      if (this.tryKey !== key.id) key.pressTarget = 0;
      this.wake(0.3);
    }, seconds * 1000);
    this.wake(0.4);
  }

  private pressVisual(key: Key3D): void {
    key.pressTarget = 1;
    key.flash = 1;
    this.touch();
    if (key.half.index === 0 && this.halves.length > 1 && this.absentHalf() === undefined)
      this.sendPulse(0.45);
    this.wake(0.6);
  }

  private releaseTry(): void {
    const key = this.tryKey ? this.keys.get(this.tryKey) : undefined;
    this.tryKey = undefined;
    if (!key) return;
    key.pressTarget = 0;
    this.options.onTryRelease?.(key.row, key.col);
    this.wake(0.4);
  }

  private bindPointer(): void {
    const canvas = this.canvas;
    // phase de capture : passe avant OrbitControls, qui doit rester inactif pendant une peinture ou un essai
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        this.touch();
        const hit = this.pick(event.clientX, event.clientY);
        this.down = { x: event.clientX, y: event.clientY, hit, button: event.button };
        if (event.button !== 0 || !hit || hit.layer !== undefined) return;
        const key = hit.key;
        if (this.mode === 'paint') {
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.painting = key.id;
          this.tap(key, 0.09);
          this.options.onPaintStart?.(key.row, key.col, event);
        } else if (this.mode === 'try') {
          this.controls.enabled = false;
          canvas.setPointerCapture(event.pointerId);
          this.tryKey = key.id;
          this.pressVisual(key);
          this.options.onTryPress?.(key.row, key.col);
        }
      },
      { capture: true },
    );
    canvas.addEventListener('pointermove', (event) => {
      const hit = this.pick(event.clientX, event.clientY);
      const onKey = hit && hit.layer === undefined ? hit.key : undefined;
      if (this.painting && onKey && onKey.id !== this.painting && event.buttons & 1) {
        this.painting = onKey.id;
        this.tap(onKey, 0.09);
        this.options.onPaintEnter?.(onKey.row, onKey.col);
      }
      if (onKey?.id !== this.hover) {
        this.hover = onKey?.id;
        this.wake(0.4);
      }
      canvas.classList.toggle('is-hover', Boolean(hit) && this.mode !== 'paint');
      this.options.onHover?.(hit && !this.painting ? this.sceneHit(hit) : undefined, event);
    });
    canvas.addEventListener('pointerleave', (event) => {
      canvas.classList.remove('is-hover');
      if (this.hover !== undefined) {
        this.hover = undefined;
        this.wake(0.4);
      }
      this.options.onHover?.(undefined, event);
    });
    const up = (event: PointerEvent): void => {
      const down = this.down;
      this.down = undefined;
      if (this.painting) {
        this.painting = undefined;
        this.options.onPaintEnd?.();
      }
      if (this.tryKey) this.releaseTry();
      if (!this.tween) this.controls.enabled = true;
      this.wake(0.4);
      if (event.type !== 'pointerup' || down?.button !== 0) return;
      const still = Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6;
      if (this.mode === 'keys') {
        if (!still) return;
        const hit = down.hit;
        if (!hit) {
          this.options.onBackgroundClick?.();
          return;
        }
        if (hit.layer !== undefined)
          this.options.onLayerPick?.(hit.layer, { row: hit.key.row, col: hit.key.col });
        else this.options.onKeyClick(hit.key.row, hit.key.col, event);
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    const onDrop = this.options.onDrop;
    if (!onDrop) return;
    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      const hit = this.pick(event.clientX, event.clientY);
      const key = hit && hit.layer === undefined ? hit.key : undefined;
      if (key?.id !== this.dropHover) {
        this.dropHover = key?.id;
        this.attachRing(this.dropRing, key);
      }
    });
    canvas.addEventListener('dragleave', () => {
      this.dropHover = undefined;
      this.attachRing(this.dropRing, undefined);
    });
    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      const hit = this.pick(event.clientX, event.clientY);
      this.dropHover = undefined;
      this.attachRing(this.dropRing, undefined);
      if (hit && hit.layer === undefined && event.dataTransfer) {
        onDrop(hit.key.row, hit.key.col, event.dataTransfer);
      }
    });
  }

  /** Activité : repousse l'auto-rotation de la vue Produit. */
  private touch(): void {
    this.idleAt = now();
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(
      () => {
        this.wake(0.1);
      },
      IDLE_ROTATE_S * 1000 + 100,
    );
  }

  private autoRotate(t: number): boolean {
    return (
      !reducedMotion() &&
      !this.tween &&
      this.view === 'product' &&
      this.selected === undefined &&
      !this.painting &&
      !this.tryKey &&
      t - this.idleAt > IDLE_ROTATE_S &&
      document.visibilityState === 'visible' &&
      ![...this.keys.values()].some((k) => k.pressTarget > 0)
    );
  }

  private sendPulse(duration: number): void {
    const pulse = this.pulses.find((p) => !p.active);
    if (!pulse || !this.cableCurve) return;
    pulse.t0 = now();
    pulse.duration = duration;
    pulse.active = true;
  }

  // ------------------------------------------------------------------ caméra

  /** Moitié seule à l'écran : la seule reliée, ou celle de la vue éclatée (droite, sauf si elle manque). */
  private soloHalf(view: SceneView): Half | undefined {
    if (this.halves.length < 2) return undefined;
    const absent = this.absentHalf();
    if (absent !== undefined) return this.halves.find((h) => h.index !== absent);
    return view === 'exploded' ? this.halves[this.halves.length - 1] : undefined;
  }

  private viewTarget(view: SceneView): THREE.Vector3 {
    const spec = VIEWS[view];
    let x = 0;
    const half = this.soloHalf(view);
    if (half) {
      const center = (half.bounds.minX + half.bounds.maxX) / 2;
      x = center - (this.bounds.minX + this.bounds.maxX) / 2 + (half.sign * this.split.gap) / 2;
      // place à droite pour les étiquettes des pièces
      if (view === 'exploded') x += 2.2;
    }
    return new THREE.Vector3(x, spec.ty, spec.tz);
  }

  private fitRadius(view: SceneView): number {
    const { width: W, height: H } = this.size;
    if (W < 2 || H < 2) return 30;
    const fw = Math.max(200, W - this.insets.left - this.insets.right);
    const fh = Math.max(200, H - this.insets.top - this.insets.bottom);
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const alone = this.absentHalf() !== undefined ? this.soloHalf(view) : undefined;
    const split = this.halves.length > 1 && !alone ? this.split.gap + this.split.splay * 0.06 : 0;
    const width =
      (alone ? alone.bounds.maxX - alone.bounds.minX : this.bounds.maxX - this.bounds.minX) +
      split +
      (alone ? 3.4 : 1.4);
    const depth = this.bounds.maxY - this.bounds.minY + 1.3 + (view === 'stack' ? 2.1 : 0);
    const radius = Math.max(width / 2 / ((tan * fw) / H), depth / 2 / ((tan * fh) / H));
    return radius * VIEWS[view].k * (view === 'top' ? 1.02 : 1.08);
  }

  private snapTo(view: SceneView): void {
    const spec = VIEWS[view];
    const target = this.viewTarget(view);
    this.camera.position
      .setFromSpherical(new THREE.Spherical(this.fitRadius(view), spec.phi, spec.theta))
      .add(target);
    this.controls.target.copy(target);
    this.controls.update();
  }

  private flyTo(view: SceneView, duration: number, from?: THREE.Spherical): void {
    this.userMoved = false;
    if (reducedMotion() || duration <= 0.01) {
      this.tween = undefined;
      this.snapTo(view);
      this.wake(0.2);
      return;
    }
    const spec = VIEWS[view];
    const start =
      from?.clone() ??
      new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    const to = new THREE.Spherical(this.fitRadius(view), spec.phi, spec.theta);
    to.theta = start.theta + Math.atan2(Math.sin(to.theta - start.theta), Math.cos(to.theta - start.theta));
    this.tween = {
      t0: now(),
      duration,
      from: start,
      to,
      fromTarget: this.controls.target.clone(),
      target: this.viewTarget(view),
    };
    this.controls.enabled = false;
    this.wake(duration);
  }

  private applyViewOffset(): void {
    const { width: W, height: H } = this.size;
    if (W < 2 || H < 2) return;
    const { left, right, top, bottom } = this.insets;
    this.camera.setViewOffset(W, H, -(left - right) / 2, -(top - bottom) / 2, W, H);
    this.camera.updateProjectionMatrix();
  }

  private resize(): void {
    const { width, height } = this.element.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    this.size = { width, height };
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyViewOffset();
    if (!this.started) {
      // arrivée : la caméra descend en tournant vers la vue demandée, les LED s'allument le long de la chaîne
      this.started = true;
      this.bootAt = now();
      const target = this.viewTarget(this.view);
      const intro = new THREE.Spherical(this.fitRadius('product') * 1.5, 0.5, -0.7);
      this.controls.target.copy(target);
      this.camera.position.setFromSpherical(intro).add(target);
      this.flyTo(this.view, 2.6, intro);
    } else if (!this.userMoved && !this.tween) {
      this.snapTo(this.view);
    }
    this.wake(0.3);
  }

  // ------------------------------------------------------------------ rendu

  private readonly onThemeChange = (): void => {
    this.applyTheme();
  };

  private applyTheme(): void {
    const css = getComputedStyle(document.documentElement);
    const stage =
      parseCssColor(css.getPropertyValue('--stage')) ?? parseCssColor(css.getPropertyValue('--bg'));
    const flag = css.getPropertyValue('--scene-dark').trim();
    const luminance = stage ? 0.2126 * stage[0] + 0.7152 * stage[1] + 0.0722 * stage[2] : 1;
    const dark = flag === '' ? luminance < 0.5 : flag === '1';
    this.scene.background = stage
      ? new THREE.Color().setRGB(stage[0], stage[1], stage[2], THREE.SRGBColorSpace)
      : null;
    this.lights.hemi.intensity = dark ? 0.35 : 0.75;
    this.lights.hemi.groundColor.set(dark ? '#0b0b0d' : '#d1d1d6');
    this.lights.key.intensity = dark ? 1.25 : 1.55;
    this.lights.rim.intensity = dark ? 0.9 : 0.35;
    this.shadow.opacity = dark ? 0.45 : 0.1;
    this.theme = dark ? { glow: 0.6, spill: 0.12, contact: 0.55 } : { glow: 0.3, spill: 0, contact: 0.16 };
    for (const half of this.halves) half.contact.material.opacity = this.theme.contact;
    const accent = parseCssColor(css.getPropertyValue('--accent')) ?? [0, 0.48, 1];
    const boost = dark ? 1.3 : 1;
    this.selectRing.material.color
      .setRGB(accent[0], accent[1], accent[2], THREE.SRGBColorSpace)
      .multiplyScalar(boost);
    this.beam.material.color.setRGB(accent[0], accent[1], accent[2], THREE.SRGBColorSpace);
    this.dropRing.material.color.set(dark ? '#FFD60A' : '#FF9500');
    this.wake(0.3);
  }

  private rebuildCable(): void {
    const [left, right] = this.halves;
    if (this.halves.length !== 2 || !left?.linkAnchor || !right?.linkAnchor) return;
    this.scene.updateMatrixWorld(true);
    const end = (link: NonNullable<Half['linkAnchor']>): [THREE.Vector3, THREE.Vector3] => {
      const p = link.anchor.getWorldPosition(new THREE.Vector3());
      const dir = link.dir.clone().applyQuaternion(link.anchor.getWorldQuaternion(new THREE.Quaternion()));
      return [p, p.clone().addScaledVector(dir, 0.45)];
    };
    const [pL, a] = end(left.linkAnchor);
    const [pR, c] = end(right.linkAnchor);
    const mid = pL.clone().lerp(pR, 0.5);
    mid.y = 0.045;
    mid.z = Math.min(pL.z, pR.z) - 1.1 - this.geo.gap * 0.08;
    const a2 = a.clone().lerp(mid, 0.5);
    a2.y = 0.045;
    const c2 = c.clone().lerp(mid, 0.5);
    c2.y = 0.045;
    this.cableCurve = new THREE.CatmullRomCurve3([pL, a, a2, mid, c2, c, pR], false, 'centripetal');
    const geometry = new THREE.TubeGeometry(this.cableCurve, 120, 0.04, 8, false);
    if (this.cable) {
      this.cable.geometry.dispose();
      this.cable.geometry = geometry;
    } else {
      this.cable = new THREE.Mesh(geometry, this.cableMat);
      this.cable.castShadow = true;
      this.scene.add(this.cable);
    }
  }

  private toScreen(object: THREE.Object3D): { x: number; y: number } {
    const p = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.size.width, y: (-p.y * 0.5 + 0.5) * this.size.height };
  }

  /** Étiquettes HTML : pièces de la vue éclatée (colonne à droite, traits de rappel), couches de la pile. */
  private updateLabels(): void {
    const showParts =
      this.explodeF > 0.55 &&
      this.parts.length > 0 &&
      this.halves[this.halves.length - 1]?.root.visible !== false;
    this.leaders.style.opacity = showParts ? '1' : '0';
    if (showParts) {
      const items = this.parts.map((part) => ({ part, s: this.toScreen(part.anchor) }));
      items.sort((a, b) => a.s.y - b.s.y);
      const colW = Math.max(...items.map((o) => o.part.el.offsetWidth || 150));
      const colX = this.size.width - this.insets.right - colW - 20;
      const total = items.reduce((sum, o) => sum + (o.part.el.offsetHeight || 34) + 14, -14);
      const middle = items.reduce((sum, o) => sum + o.s.y, 0) / items.length;
      let last = Math.max(this.insets.top + 8, middle - total / 2) - 14;
      const alpha = String(clamp((this.explodeF - 0.55) * 3, 0, 1));
      for (const { part, s } of items) {
        const y = last + 14;
        last = y + (part.el.offsetHeight || 34);
        part.el.style.transform = `translate(${px(colX)}, ${px(y)})`;
        part.el.style.opacity = alpha;
        part.line.setAttribute('x1', s.x.toFixed(1));
        part.line.setAttribute('y1', s.y.toFixed(1));
        part.line.setAttribute('x2', (colX - 6).toFixed(1));
        part.line.setAttribute('y2', (y + 9).toFixed(1));
        part.dot.setAttribute('cx', s.x.toFixed(1));
        part.dot.setAttribute('cy', s.y.toFixed(1));
      }
    } else {
      for (const part of this.parts) if (part.el.style.opacity !== '0') part.el.style.opacity = '0';
    }
    const showStack = this.stackF > 0.4;
    // étiquettes à gauche de la pile de la première moitié affichée (la droite si la gauche n'est pas reliée)
    const first = this.halves.find((h) => h.root.visible) ?? this.halves[0];
    if (!showStack || !first) {
      for (const label of this.stackLabels) {
        if (label.el.style.opacity === '0') continue;
        label.el.style.opacity = '0';
        label.el.style.pointerEvents = 'none';
        label.el.tabIndex = -1;
      }
      return;
    }
    // une étiquette par dalle, à gauche de la pile ; écartées si les dalles sont trop proches à l'écran
    const placed = this.stackLabels.map((label) => {
      if (label.anchor.parent !== first.groups.stack) first.groups.stack.add(label.anchor);
      label.anchor.position.set(
        first.bounds.minX - 0.3,
        STACK_Y0 + label.layer * STACK_DY * this.stackF,
        first.bounds.minY - 0.2,
      );
      return { label, p: this.toScreen(label.anchor), h: label.el.offsetHeight || 26 };
    });
    placed.sort((a, b) => a.p.y - b.p.y);
    const ys = spreadApart(
      placed.map((o) => o.p.y),
      placed.map((o) => o.h + 4),
    );
    const alpha = String(clamp((this.stackF - 0.4) * 2.5, 0, 1));
    placed.forEach(({ label, p }, i) => {
      label.el.classList.toggle('is-cur', label.layer === this.layer);
      const x = Math.max(p.x, this.insets.left + 8 + label.el.offsetWidth);
      label.el.style.transform = `translate(${px(x)}, ${px(ys[i] ?? p.y)}) translate(-100%, -50%)`;
      label.el.style.opacity = alpha;
      label.el.style.pointerEvents = 'auto';
      label.el.tabIndex = 0;
    });
  }

  private wake(seconds: number): void {
    this.activeUntil = Math.max(this.activeUntil, now() + seconds);
    if (this.frame || this.disposed) return;
    this.last = now();
    this.frame = requestAnimationFrame(this.loop);
  }

  private readonly loop = (): void => {
    this.frame = 0;
    if (this.disposed) return;
    const t = now();
    // temps réel entre deux images (rendu logiciel lent compris), borné après une pause de l'onglet
    const dt = Math.min(0.25, t - this.last);
    this.last = t;
    let busy = t < this.activeUntil;
    const damp = (value: number, target: number, lambda: number, eps = 1e-4): number => {
      const next = THREE.MathUtils.damp(value, target, lambda, dt);
      if (Math.abs(next - target) < eps) return target;
      busy = true;
      return next;
    };

    // caméra
    const tween = this.tween;
    if (tween) {
      const p = clamp((t - tween.t0) / tween.duration, 0, 1);
      const e = ease(p);
      this.controls.target.lerpVectors(tween.fromTarget, tween.target, e);
      this.camera.position
        .setFromSpherical(
          new THREE.Spherical(
            THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, e),
            THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, e),
            THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, e),
          ),
        )
        .add(this.controls.target);
      if (p >= 1) {
        this.tween = undefined;
        if (!this.painting && !this.tryKey) this.controls.enabled = true;
      }
      busy = true;
    }
    const rotate = this.autoRotate(t);
    this.controls.autoRotate = rotate;
    if (this.controls.update(dt) || rotate) busy = true;

    // transitions : coque, géométrie du split, éclaté, rayons X, pile
    const before = this.caseF + this.geo.gap + this.geo.tent + this.geo.splay + this.explodeF;
    this.caseF = damp(this.caseF, this.caseOn ? 1 : 0, 7);
    this.geo.gap = damp(this.geo.gap, this.split.gap, 8);
    this.geo.tent = damp(this.geo.tent, this.split.tent, 8, 1e-3);
    this.geo.splay = damp(this.geo.splay, this.split.splay, 8, 1e-3);
    this.explodeF = damp(this.explodeF, this.view === 'exploded' ? 1 : 0, 5);
    this.xrayF = damp(this.xrayF, this.view === 'xray' ? 1 : 0, 6);
    this.stackF = damp(this.stackF, this.view === 'stack' ? 1 : 0, 5);
    if (before !== this.caseF + this.geo.gap + this.geo.tent + this.geo.splay + this.explodeF)
      this.cablesDirty = true;
    const lift = CASE_FLOOR * this.caseF + 0.07 * (1 - this.caseF);
    this.world.position.y = lift;
    const e = this.explodeF;
    const solo = e > 0.15 && this.halves.length > 1;
    const selected = this.selected ? this.keys.get(this.selected) : undefined;
    const caseShown = this.caseF > 0.02;
    const absent = this.absentHalf();
    this.linkF = damp(this.linkF, absent === undefined ? 1 : 0, 6, 1e-3);
    if (absent !== undefined) this.goneHalf = absent;
    else if (this.linkF >= 1) this.goneHalf = undefined;
    const away = 1 - this.linkF;
    // vue éclatée : une seule moitié (la droite, ou la gauche si la droite n'est pas reliée)
    const exploded = solo ? (this.soloHalf('exploded') ?? this.halves[this.halves.length - 1]) : undefined;
    for (const half of this.halves) {
      const gone = half.index === this.goneHalf;
      half.root.position.x = (half.sign * this.geo.gap) / 2 + (gone ? half.sign * away * 9 : 0);
      half.tent.rotation.z = -half.sign * rad(this.geo.tent);
      half.splay.rotation.y = -half.sign * rad(this.geo.splay);
      half.root.visible = !(exploded && half !== exploded) && !(gone && away > 0.98);
      const g = half.groups;
      g.caps.position.y = e * 1.6;
      g.switches.position.y = e * 0.85;
      g.leds.position.y = e * 0.02;
      g.sockets.position.y = -e * 0.55;
      g.pico.position.y = e * 0.5;
      g.caseTop.position.y = e * 0.5;
      g.caseBot.position.y = -e * 1.05;
      g.caseTop.visible = caseShown;
      g.caseBot.visible = caseShown;
      half.contact.position.y = 0.002 - lift;
      half.spill.position.y = 0.003 - lift;
      half.glow.position.y = (CASE_TOP + 0.004) * this.caseF;
      g.xray.visible = this.xrayF > 0.01;
      g.stack.visible = this.stackF > 0.01;
      const mine = selected?.half === half ? selected : undefined;
      for (const tube of half.rowTubes)
        tube.mesh.material.opacity = this.xrayF * (mine?.row === tube.row ? 1 : 0.45);
      for (const tube of half.colTubes)
        tube.mesh.material.opacity = this.xrayF * (mine?.col === tube.col ? 1 : 0.4);
      half.swTop.material.opacity = 0.6 * (1 - this.xrayF * 0.8);
      if (half.chain) {
        half.chain.uT.value = t;
        half.chain.uO.value = this.xrayF;
      }
      for (const slab of half.slabs) {
        slab.group.position.y = STACK_Y0 + slab.layer * STACK_DY * this.stackF;
        const cur = slab.layer === this.layer;
        slab.plate.material.opacity = this.stackF * (cur ? 0.16 : 0.05);
        slab.edge.material.opacity = this.stackF * (cur ? 0.9 : 0.3);
        slab.solid.material.opacity = this.stackF * (cur ? 0.95 : 0.6);
        slab.ghost.material.opacity = this.stackF * (cur ? 0.12 : 0.05);
        slab.none.material.opacity = this.stackF * 0.4;
      }
    }
    if (this.xrayF > 0.01) busy = true; // chaîne LED animée
    const xr = this.xrayF > 0.01;
    if (xr !== this.xrayOn) {
      // keycaps : transparence gérée touche par touche (rayons X ou moitié non reliée)
      this.caseMat.transparent = xr;
      this.caseMat.depthWrite = !xr;
      this.caseMat.needsUpdate = true;
      this.xrayOn = xr;
    }
    this.caseMat.opacity = 1 - this.xrayF * 0.88;
    if (this.cablesDirty) {
      this.rebuildCable();
      this.cablesDirty = false;
    }
    // câble entre moitiés : seulement quand les deux sont à leur place
    if (this.cable) this.cable.visible = !solo && this.linkF > 0.98;

    if (selected && this.stackF > 0.05 && this.stackCount > 0) {
      const stack = selected.half.groups.stack;
      if (this.beam.parent !== stack) stack.add(this.beam);
      const top = STACK_Y0 + (this.stackCount - 1) * STACK_DY * this.stackF;
      this.beam.position.set(selected.place.cx, (CAP_Y + top) / 2, selected.place.cy);
      this.beam.scale.set(1, Math.max(0.001, top - CAP_Y), 1);
      this.beam.material.opacity = this.stackF * 0.5;
      this.beam.visible = true;
    } else {
      this.beam.visible = false;
    }
    const ringY = PCB_TOP + 0.008 + (CASE_TOP + 0.002) * this.caseF;
    this.selectRing.position.y = ringY;
    this.dropRing.position.y = ringY;

    // touches : fondu flou des légendes, survol, appui, moitié non reliée, LED (légende teintée, jupe, puce, halo)
    const spill = this.halves.map(() => new THREE.Color(0, 0, 0));
    const srgb = this.tmp2;
    const reduced = reducedMotion();
    for (const key of this.keys.values()) {
      // la légende se floute et s'estompe, la nouvelle est dessinée au plus flou (une fois, réparti sur quatre
      // images pour éviter un à-coup), puis redevient nette
      let fade = 1;
      if (key.pending) {
        busy = true;
        if (key.flipAt !== undefined && t >= key.flipAt) {
          const p = reduced ? 1 : (t - key.flipAt) / LEGEND_SWAP_S;
          const w = Math.sin(Math.min(1, p) * Math.PI);
          if (!key.flipSwapped && p >= 0.4 + (key.index % 4) * 0.05) {
            this.paintLegend(key, key.pending.view, key.pending.sig);
            key.flipSwapped = true;
          }
          if (p >= 1) {
            key.pending = undefined;
            key.flipAt = undefined;
            key.blur.value = 0;
          } else {
            fade = 1 - 0.6 * w;
            key.blur.value = 3.2 * w;
          }
        }
      }
      key.ghost = damp(key.ghost, key.half.index === absent ? 1 : 0, 8, 1e-3);
      const seeThrough = xr || key.ghost > 0.01;
      if (key.capMat.transparent !== seeThrough) {
        key.capMat.transparent = seeThrough;
        key.capMat.depthWrite = !seeThrough;
        key.capMat.needsUpdate = true;
      }
      const liftTarget =
        (key.id === this.hover && !this.painting ? 0.04 : 0) + (key.id === this.selected ? 0.07 : 0);
      key.lift = damp(key.lift, liftTarget, 14);
      key.press = damp(key.press, key.pressTarget, key.pressTarget > key.press ? 40 : 18);
      key.inner.position.y = key.lift - key.press * TRAVEL;
      if (key.flash > 0) {
        key.flash = Math.max(0, key.flash - dt * 2.6);
        busy = true;
      }
      const boot =
        this.bootAt === undefined ? 1 : clamp((t - this.bootAt - 0.5 - key.chain * 0.025) / 0.3, 0, 1);
      if (boot < 1) busy = true;
      const fl = key.flash * 0.45;
      const lit = boot * (1 - key.ghost);
      this.tmp.setRGB(
        clamp(key.rgb[0] * lit + fl, 0, 1),
        clamp(key.rgb[1] * lit + fl, 0, 1),
        clamp(key.rgb[2] * lit + fl, 0, 1),
        THREE.SRGBColorSpace,
      );
      const gap =
        Math.abs(key.led.r - this.tmp.r) +
        Math.abs(key.led.g - this.tmp.g) +
        Math.abs(key.led.b - this.tmp.b);
      if (gap < 1e-3) key.led.copy(this.tmp);
      else {
        key.led.lerp(this.tmp, 1 - Math.exp(-dt * 18));
        busy = true;
      }
      key.skirtMat.emissive.copy(key.led);
      srgb.copy(key.led).convertLinearToSRGB();
      const [r, g, b] = legendColor([srgb.r, srgb.g, srgb.b]);
      key.legendMat.color.setRGB(r, g, b, THREE.SRGBColorSpace);
      key.legendMat.opacity = (1 - this.xrayF * 0.85) * fade * (1 - 0.72 * key.ghost);
      key.capMat.opacity = (1 - this.xrayF * 0.86) * (1 - 0.62 * key.ghost);
      key.skirtMat.opacity = 0.94 * (1 - this.xrayF * 0.7) * (1 - 0.7 * key.ghost);
      key.half.chip.setColorAt(key.index, key.led);
      key.half.glow.setColorAt(key.index, this.tmp.copy(key.led).multiplyScalar(this.theme.glow));
      spill[key.half.index]?.add(key.led);
    }
    this.halves.forEach((half, i) => {
      if (half.chip.instanceColor) half.chip.instanceColor.needsUpdate = true;
      if (half.glow.instanceColor) half.glow.instanceColor.needsUpdate = true;
      half.spill.material.color
        .copy(spill[i] ?? new THREE.Color())
        .multiplyScalar(this.theme.spill / Math.max(1, half.keys.length));
    });

    // impulsions de données sur le câble (moitié gauche vers la maîtresse)
    for (const pulse of this.pulses) {
      if (!pulse.active) continue;
      busy = true;
      const q = (t - pulse.t0) / pulse.duration;
      if (q >= 1 || !this.cableCurve) {
        pulse.active = false;
        pulse.mesh.visible = false;
        continue;
      }
      pulse.mesh.visible = q >= 0;
      if (q < 0) continue;
      this.cableCurve.getPointAt(q, pulse.mesh.position);
      pulse.mesh.position.y += 0.045;
      pulse.mesh.material.opacity = Math.sin(q * Math.PI);
    }

    if (this.halfTags.length) this.updateHalfTags();
    const labels = this.explodeF > 0.001 || this.stackF > 0.001;
    if (labels || this.labelsShown) this.updateLabels();
    this.labelsShown = labels;

    if (this.size.width >= 2) {
      this.renderer.render(this.scene, this.camera);
      if (!this.ready) {
        this.ready = true;
        this.options.onReady?.();
      }
    }
    if ((busy || now() < this.activeUntil) && !this.frame) this.frame = requestAnimationFrame(this.loop);
  };
}
