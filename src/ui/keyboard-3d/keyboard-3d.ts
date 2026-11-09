// Vue 3D du clavier (three.js), chargée à la demande : keycaps à légendes rétroéclairées, LED en direct,
// coque noir mat au contour du PCB. Mêmes interactions que le dessin SVG : clic pour choisir, glisser pour peindre.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { KeyGeometry } from '../../keyboard/kle';
import type { Model3D } from '../../profiles';
import type { LedPaints } from '../../rgb/led-preview';
import { keyId, type KeyKind, type KeyView } from '../keyboard-view';
import {
  fallbackOutline,
  offsetPolygon,
  placeKey,
  rotatedSquare,
  sceneBounds,
  type KeyPlacement,
  type Point,
} from './geometry';
import { drawLegend, LEGEND_PX, legendKey } from './legend';
import { ledColor, legendColor, parseCssColor } from './led-color';

export type CameraPreset = 'product' | 'top';

export interface Keyboard3DOptions {
  readonly keys: readonly KeyGeometry[];
  readonly model?: Model3D | undefined;
  readonly text: { readonly canvas: string; readonly product: string; readonly top: string };
  /** Clic sur une touche (relâché sur la touche où l'appui a commencé, sans avoir fait tourner la vue). */
  readonly onKeyClick: (row: number, col: number, event: MouseEvent) => void;
  /** Mode peinture : appui sur une touche, passage sur une autre bouton enfoncé, relâché. */
  readonly onPaintStart?: (row: number, col: number, event: PointerEvent) => void;
  readonly onPaintEnter?: (row: number, col: number) => void;
  readonly onPaintEnd?: () => void;
}

export interface Keyboard3DState {
  readonly views: readonly KeyView[];
  readonly selected?: string | undefined;
  readonly layer: number;
  readonly paintMode: boolean;
}

// Hauteurs en unités de touche (1U = 19,05 mm) : bac, PCB, dessus de coque, switch profil bas, keycap.
const FLOOR_TOP = 0.16;
const PCB_TOP = FLOOR_TOP + 0.084;
const PLATE_TOP = PCB_TOP + 0.078;
const SWITCH_H = 0.13;
const CAP_Y = PCB_TOP + 0.25;
const CAP_H = 0.2;
const SKIRT_H = 0.085;
const TRAVEL = 0.1;

const PRESETS: Record<CameraPreset, { phi: number; theta: number }> = {
  product: { phi: 0.86, theta: 0 },
  top: { phi: 0.04, theta: 0 },
};

interface Key3D {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly place: KeyPlacement;
  readonly group: THREE.Group;
  readonly inner: THREE.Group;
  readonly capMat: THREE.MeshStandardMaterial;
  readonly skirtMat: THREE.MeshStandardMaterial;
  readonly legend: THREE.Mesh;
  readonly legendMat: THREE.MeshBasicMaterial;
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  readonly glowIndex: number;
  sig: string;
  title: string;
  pending: { sig: string; view: KeyView } | undefined;
  flipAt: number | undefined;
  flipSwapped: boolean;
  readonly led: THREE.Color;
  readonly target: THREE.Color;
  press: number;
  pressTarget: number;
  lift: number;
}

const now = (): number => performance.now() / 1000;

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

function radialTexture(stops: readonly (readonly [number, number])[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(255,255,255,${String(alpha)})`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function boardTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 536;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#1f6b40';
    g.fillRect(0, 0, 220, 536);
    g.fillStyle = '#c9a55a';
    for (let n = 0; n < 20; n++) {
      const y = 18 + n * 26.6;
      g.beginPath();
      g.arc(4, y, 9, 0, Math.PI * 2);
      g.arc(216, y, 9, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#17141a';
    g.fillRect(70, 230, 80, 80);
    g.fillStyle = '#f2efe9';
    g.font = '600 18px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(label, 110, 420);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Keyboard3D {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly keys = new Map<string, Key3D>();
  private readonly capMeshes: THREE.Mesh[] = [];
  private readonly glows: THREE.InstancedMesh;
  private readonly lights: {
    hemi: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
  };
  private readonly shadow: THREE.ShadowMaterial;
  private readonly contacts: THREE.MeshBasicMaterial[] = [];
  private readonly selectRing: THREE.Mesh;
  private readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  private readonly resizeObserver: ResizeObserver;
  private readonly themeObserver: MutationObserver;
  private readonly themeQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly raycaster = new THREE.Raycaster();
  private readonly presetButtons = new Map<CameraPreset, HTMLButtonElement>();
  private glowStrength = 0.3;
  private layer: number | undefined;
  private selected: string | undefined;
  private hover: string | undefined;
  private paintMode = false;
  private down: { x: number; y: number; key: string | undefined } | undefined;
  private painting: string | undefined;
  private frame = 0;
  private last = now();
  private activeUntil = 0;
  private tween:
    | {
        t0: number;
        from: THREE.Spherical;
        to: THREE.Spherical;
        target: THREE.Vector3;
        fromTarget: THREE.Vector3;
      }
    | undefined;
  private disposed = false;
  private preset: CameraPreset = 'product';
  private userMoved = false;

  constructor(private readonly options: Keyboard3DOptions) {
    this.element = document.createElement('div');
    this.element.className = 'keyboard-3d';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', options.text.canvas);
    this.element.append(this.canvas, this.presetBar());

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd1d1d6, 0.75);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-5, 18, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 2, far: 50 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(8, 6, -12);
    this.lights = { hemi, key, rim };
    this.scene.add(hemi, key, rim);
    this.shadow = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.shadow);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // tout est construit dans le repère de la disposition (x, z = y KLE), puis centré
    const world = new THREE.Group();
    this.scene.add(world);
    const outlines: readonly (readonly Point[])[] = options.model?.outlines.length
      ? options.model.outlines
      : [fallbackOutline(options.keys)];
    this.bounds = sceneBounds(options.keys, outlines);
    world.position.set(
      -(this.bounds.minX + this.bounds.maxX) / 2,
      0,
      -(this.bounds.minY + this.bounds.maxY) / 2,
    );

    const placements = options.keys.map(placeKey);
    this.buildCase(world, outlines, placements, options.model);
    this.glows = this.buildSwitchesAndGlows(world, placements);
    placements.forEach((place, index) => {
      this.buildKey(world, place, index);
    });
    this.selectRing = new THREE.Mesh(
      this.ringGeometry(1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
        depthWrite: false,
      }),
    );
    this.selectRing.position.y = PLATE_TOP + 0.004;
    this.selectRing.visible = false;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.45;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => {
      this.wake(0.3);
    });
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
      this.tween = undefined;
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
      attributeFilter: ['data-theme'],
    });
    this.themeQuery.addEventListener('change', this.onThemeChange);
    this.applyTheme();
    this.setPreset('product', false);
    this.loop();
  }

  /** WebGL 2 disponible ? Sinon l'application garde le dessin en plan. */
  static supported(): boolean {
    try {
      return Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      return false;
    }
  }

  /** Légendes, touche choisie et mode ; un changement de couche fait basculer les légendes en vague. */
  setState({ views, selected, layer, paintMode }: Keyboard3DState): void {
    const t = now();
    const layerChanged = this.layer !== undefined && layer !== this.layer;
    this.layer = layer;
    for (const view of views) {
      const key = this.keys.get(keyId(view.geometry.row, view.geometry.col));
      if (!key) continue;
      key.title = view.title;
      const sig = legendKey(view.label, view.kind);
      if (sig === key.sig && !key.pending) continue;
      if (key.sig === '') {
        this.paintLegend(key, view.label, view.kind, sig);
        continue;
      }
      key.pending = { sig, view };
      key.flipSwapped = false;
      key.flipAt = t + (layerChanged ? (key.place.cx + key.place.cy * 0.6) * 0.022 : 0);
    }
    this.paintMode = paintMode;
    this.canvas.classList.toggle('is-paint', paintMode);
    if (selected !== this.selected) {
      this.selected = selected;
      const key = selected ? this.keys.get(selected) : undefined;
      if (key) {
        this.selectRing.geometry.dispose();
        this.selectRing.geometry = this.ringGeometry(key.place.w);
        key.group.add(this.selectRing);
        this.selectRing.visible = true;
      } else {
        this.selectRing.removeFromParent();
        this.selectRing.visible = false;
      }
    }
    this.wake(1);
  }

  /** Couleurs des LED (aperçu en direct ou couleurs de la couche) ; les touches absentes s'éteignent. */
  setPaints(paints: LedPaints): void {
    for (const key of this.keys.values()) {
      const [r, g, b] = ledColor(paints.get(key.id));
      key.target.setRGB(r, g, b, THREE.SRGBColorSpace);
    }
    this.wake(0.6);
  }

  setPreset(preset: CameraPreset, animate = true): void {
    this.preset = preset;
    this.userMoved = false;
    for (const [name, button] of this.presetButtons)
      button.setAttribute('aria-pressed', String(name === preset));
    const { phi, theta } = PRESETS[preset];
    const to = new THREE.Spherical(this.fitRadius(preset), phi, theta);
    const target = new THREE.Vector3(0, preset === 'top' ? 0 : 0.2, 0.25);
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.setFromSpherical(to).add(target);
      this.controls.target.copy(target);
      this.controls.update();
      this.wake(0.3);
      return;
    }
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    to.theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
    this.tween = { t0: now(), from, to, target, fromTarget: this.controls.target.clone() };
    this.wake(1.2);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
    this.themeQuery.removeEventListener('change', this.onThemeChange);
    this.controls.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = object as THREE.Mesh;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.element.remove();
  }

  // ------------------------------------------------------------------ construction

  private presetBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'keyboard-3d__views';
    for (const [preset, text] of [
      ['product', this.options.text.product],
      ['top', this.options.text.top],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.dataset.preset = preset;
      button.addEventListener('click', () => {
        this.setPreset(preset);
      });
      this.presetButtons.set(preset, button);
      bar.append(button);
    }
    return bar;
  }

  private buildCase(
    world: THREE.Group,
    outlines: readonly (readonly Point[])[],
    placements: readonly KeyPlacement[],
    model: Model3D | undefined,
  ): void {
    const caseMat = new THREE.MeshStandardMaterial({
      color: '#151517',
      roughness: 0.93,
      envMapIntensity: 0.2,
    });
    const pcbMat = new THREE.MeshStandardMaterial({ color: model?.pcbColor ?? '#2a2a2e', roughness: 0.6 });
    const softTex = radialTexture([
      [0, 1],
      [0.45, 0.55],
      [1, 0],
    ]);
    for (const outline of outlines) {
      const inside = (p: KeyPlacement): boolean => this.contains(outline, p.cx, p.cy);
      const meshes: [THREE.BufferGeometry, THREE.Material][] = [
        [extrude(roundedPath(outline, 0.05, new THREE.Shape()), FLOOR_TOP - 0.07, 0), caseMat],
        [this.wall(outline), caseMat],
        [extrude(roundedPath(outline, 0.05, new THREE.Shape()), PCB_TOP - FLOOR_TOP, FLOOR_TOP), pcbMat],
      ];
      const top = roundedPath(outline, 0.05, new THREE.Shape());
      for (const p of placements.filter(inside))
        top.holes.push(roundedPath(rotatedSquare(p, 0.38), 0.06, new THREE.Path()));
      meshes.push([extrude(top, PLATE_TOP - PCB_TOP, PCB_TOP, 0.005), caseMat]);
      for (const [geometry, material] of meshes) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        world.add(mesh);
      }
      // ombre de contact douce sous chaque carte
      const xs = outline.map(([x]) => x);
      const ys = outline.map(([, y]) => y);
      const contactMat = new THREE.MeshBasicMaterial({
        map: softTex,
        color: 0x000000,
        transparent: true,
        depthWrite: false,
        opacity: 0.16,
      });
      this.contacts.push(contactMat);
      const contact = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(...xs) - Math.min(...xs) + 3, Math.max(...ys) - Math.min(...ys) + 3),
        contactMat,
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.set(
        (Math.max(...xs) + Math.min(...xs)) / 2,
        0.002,
        (Math.max(...ys) + Math.min(...ys)) / 2,
      );
      world.add(contact);
    }
    for (const board of model?.boards ?? []) {
      const side = new THREE.MeshStandardMaterial({ color: '#17542f', roughness: 0.6 });
      const top = new THREE.MeshStandardMaterial({ map: boardTexture(board.label), roughness: 0.5 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 2.68), [
        side,
        side,
        top,
        side,
        side,
        side,
      ]);
      mesh.position.set(board.x, PLATE_TOP + 0.06, board.y);
      mesh.castShadow = true;
      const usb = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.14, 0.3),
        new THREE.MeshStandardMaterial({ color: '#8e8e93', metalness: 0.5, roughness: 0.5 }),
      );
      usb.position.set(board.x, PLATE_TOP + 0.155, board.y - 1.22);
      world.add(mesh, usb);
    }
  }

  private wall(outline: readonly Point[]): THREE.ExtrudeGeometry {
    const shape = roundedPath(outline, 0.05, new THREE.Shape());
    shape.holes.push(roundedPath(offsetPolygon(outline, -0.08), 0.03, new THREE.Path()));
    return extrude(shape, 0.07, FLOOR_TOP - 0.07);
  }

  private contains(outline: readonly Point[], x: number, y: number): boolean {
    let inside = false;
    outline.forEach(([xi, yi], i) => {
      const [xj, yj] = outline[(i + outline.length - 1) % outline.length] ?? [xi, yi];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    });
    return inside;
  }

  private buildSwitchesAndGlows(
    world: THREE.Group,
    placements: readonly KeyPlacement[],
  ): THREE.InstancedMesh {
    const n = placements.length;
    const bottom = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.74, SWITCH_H * 0.5, 0.74),
      new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.6 }),
      n,
    );
    const top = new THREE.InstancedMesh(
      new RoundedBoxGeometry(0.66, SWITCH_H * 0.55, 0.66, 2, 0.025),
      new THREE.MeshStandardMaterial({ color: '#f2f2f7', roughness: 0.3, transparent: true, opacity: 0.6 }),
      n,
    );
    const glowGeometry = new THREE.PlaneGeometry(1.45, 1.45);
    glowGeometry.rotateX(-Math.PI / 2);
    const glows = new THREE.InstancedMesh(
      glowGeometry,
      new THREE.MeshBasicMaterial({
        map: radialTexture([
          [0, 1],
          [0.25, 0.5],
          [0.6, 0.1],
          [1, 0],
        ]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      n,
    );
    const dummy = new THREE.Object3D();
    const place = (mesh: THREE.InstancedMesh, index: number, p: KeyPlacement, y: number, z = 0): void => {
      dummy.position.set(p.cx, y, p.cy);
      dummy.rotation.set(0, (-p.angle * Math.PI) / 180, 0);
      dummy.translateZ(z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };
    placements.forEach((p, index) => {
      place(bottom, index, p, PCB_TOP + SWITCH_H * 0.25);
      place(top, index, p, PCB_TOP + SWITCH_H * 0.775);
      place(glows, index, p, PLATE_TOP + 0.004, -0.12);
      glows.setColorAt(index, new THREE.Color(0, 0, 0));
    });
    bottom.castShadow = true;
    top.castShadow = true;
    world.add(bottom, top, glows);
    return glows;
  }

  private buildKey(world: THREE.Group, place: KeyPlacement, glowIndex: number): void {
    const id = keyId(place.row, place.col);
    const group = new THREE.Group();
    group.position.set(place.cx, 0, place.cy);
    group.rotation.y = (-place.angle * Math.PI) / 180;
    const inner = new THREE.Group();
    group.add(inner);
    const wide = place.w > 1.25 || place.h > 1.25;
    const capMat = new THREE.MeshStandardMaterial({
      color: wide ? '#2d2d31' : '#232326',
      roughness: 0.86,
      envMapIntensity: 0.25,
    });
    const cap = new THREE.Mesh(this.capGeometry(place.w, place.h), capMat);
    cap.position.y = CAP_Y;
    cap.castShadow = true;
    cap.receiveShadow = true;
    cap.userData.key = id;
    const skirtMat = new THREE.MeshStandardMaterial({
      color: '#141416',
      emissive: 0x000000,
      roughness: 0.6,
      transparent: true,
      opacity: 0.96,
      toneMapped: false,
    });
    const skirt = new THREE.Mesh(
      new RoundedBoxGeometry(place.w - 0.055, SKIRT_H, place.h - 0.055, 2, 0.035),
      skirtMat,
    );
    skirt.position.y = CAP_Y + SKIRT_H / 2 - 0.004;
    skirt.userData.key = id;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(LEGEND_PX * place.w);
    canvas.height = Math.round(LEGEND_PX * place.h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const legendMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const legendGeometry = new THREE.PlaneGeometry(
      (place.w - 0.07) * 0.915 - 0.07,
      (place.h - 0.07) * 0.915 - 0.07,
    );
    legendGeometry.rotateX(-Math.PI / 2);
    const legend = new THREE.Mesh(legendGeometry, legendMat);
    legend.position.y = CAP_Y + CAP_H + 0.003;
    inner.add(skirt, cap, legend);
    world.add(group);
    this.capMeshes.push(cap, skirt);
    this.keys.set(id, {
      id,
      row: place.row,
      col: place.col,
      place,
      group,
      inner,
      capMat,
      skirtMat,
      legend,
      legendMat,
      canvas,
      texture,
      glowIndex,
      sig: '',
      title: id,
      pending: undefined,
      flipAt: undefined,
      flipSwapped: false,
      led: new THREE.Color(0, 0, 0),
      target: new THREE.Color(0, 0, 0),
      press: 0,
      pressTarget: 0,
      lift: 0,
    });
  }

  private capGeometry(w: number, h: number): THREE.BufferGeometry {
    const geometry = new RoundedBoxGeometry(w - 0.07, CAP_H, h - 0.07, 3, 0.055);
    const position = geometry.attributes.position;
    if (position) {
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        const taper = 1 - 0.085 * ((y + CAP_H / 2) / CAP_H);
        position.setXYZ(i, position.getX(i) * taper, y + CAP_H / 2, position.getZ(i) * taper);
      }
    }
    return geometry;
  }

  private ringGeometry(w: number): THREE.ShapeGeometry {
    const rect = (W: number, D: number): Point[] => [
      [-W / 2, -D / 2],
      [W / 2, -D / 2],
      [W / 2, D / 2],
      [-W / 2, D / 2],
    ];
    const outer = roundedPath(rect(w + 0.05, 1.05), 0.14, new THREE.Shape());
    outer.holes.push(roundedPath(rect(w - 0.01, 0.99), 0.11, new THREE.Path()));
    const geometry = new THREE.ShapeGeometry(outer, 6);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  private paintLegend(key: Key3D, label: KeyView['label'], kind: KeyKind, sig: string): void {
    drawLegend(key.canvas, label, kind);
    key.texture.needsUpdate = true;
    key.sig = sig;
  }

  // ------------------------------------------------------------------ interactions

  private keyAt(event: { clientX: number; clientY: number }): Key3D | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.capMeshes, false)[0];
    const id: unknown = hit?.object.userData.key;
    return typeof id === 'string' ? this.keys.get(id) : undefined;
  }

  private bindPointer(): void {
    const canvas = this.canvas;
    // phase de capture : passe avant OrbitControls, qui doit rester inactif pendant une peinture
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        const key = this.keyAt(event);
        this.down = { x: event.clientX, y: event.clientY, key: key?.id };
        if (event.button !== 0 || !key || !this.paintMode) return;
        this.controls.enabled = false;
        canvas.setPointerCapture(event.pointerId);
        this.painting = key.id;
        key.pressTarget = 1;
        this.options.onPaintStart?.(key.row, key.col, event);
        this.wake(0.4);
      },
      { capture: true },
    );
    canvas.addEventListener('pointermove', (event) => {
      const key = this.keyAt(event);
      if (key?.id !== this.hover) {
        this.hover = key?.id;
        canvas.classList.toggle('is-hover', Boolean(key));
        canvas.title = key ? key.title : '';
        this.wake(0.4);
      }
      if (this.painting && key && key.id !== this.painting && event.buttons & 1) {
        this.painting = key.id;
        key.pressTarget = 1;
        setTimeout(() => {
          key.pressTarget = 0;
        }, 90);
        this.options.onPaintEnter?.(key.row, key.col);
      }
    });
    canvas.addEventListener('pointerleave', () => {
      if (this.hover === undefined) return;
      this.hover = undefined;
      canvas.title = '';
      this.wake(0.4);
    });
    canvas.addEventListener('pointerup', (event) => {
      const down = this.down;
      this.down = undefined;
      if (this.painting) {
        const pressed = this.keys.get(this.painting);
        if (pressed) pressed.pressTarget = 0;
        this.painting = undefined;
        this.options.onPaintEnd?.();
      }
      this.controls.enabled = true;
      if (!down?.key || event.button !== 0) return;
      const key = this.keyAt(event);
      const still = Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6;
      if (key?.id === down.key && (still || this.paintMode)) this.options.onKeyClick(key.row, key.col, event);
    });
  }

  // ------------------------------------------------------------------ rendu

  private readonly onThemeChange = (): void => {
    this.applyTheme();
  };

  private applyTheme(): void {
    const bg = parseCssColor(getComputedStyle(document.documentElement).getPropertyValue('--bg')) ?? [
      1, 1, 1,
    ];
    const dark = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] < 0.5;
    this.lights.hemi.intensity = dark ? 0.35 : 0.75;
    this.lights.hemi.groundColor.set(dark ? '#0b0b0d' : '#d1d1d6');
    this.lights.key.intensity = dark ? 1.25 : 1.55;
    this.lights.rim.intensity = dark ? 0.9 : 0.35;
    this.shadow.opacity = dark ? 0.45 : 0.1;
    for (const material of this.contacts) material.opacity = dark ? 0.55 : 0.16;
    this.glowStrength = dark ? 0.6 : 0.3;
    const accent = parseCssColor(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    const ring = this.selectRing.material as THREE.MeshBasicMaterial;
    if (accent) ring.color.setRGB(accent[0], accent[1], accent[2], THREE.SRGBColorSpace);
    this.wake(0.3);
  }

  private fitRadius(preset: CameraPreset): number {
    const rect = this.element.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const width = this.bounds.maxX - this.bounds.minX + 0.8;
    const depth = this.bounds.maxY - this.bounds.minY + 0.8;
    const radius = Math.max(width / 2 / (tan * aspect), depth / 2 / tan);
    return radius * (preset === 'top' ? 1.1 : 1.12);
  }

  private resize(): void {
    const { width, height } = this.element.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.fitRadius('product') * 0.35;
    this.controls.maxDistance = this.fitRadius('top') * 2.5;
    if (!this.userMoved && !this.tween) this.setPreset(this.preset, false);
    this.wake(0.3);
  }

  private wake(seconds: number): void {
    this.activeUntil = Math.max(this.activeUntil, now() + seconds);
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const t = now();
    const dt = Math.min(0.05, t - this.last);
    this.last = t;
    let busy = t < this.activeUntil;

    if (this.tween) {
      const p = Math.min(1, (t - this.tween.t0) / 1.1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const { from, to } = this.tween;
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.target, e);
      this.camera.position
        .setFromSpherical(
          new THREE.Spherical(
            THREE.MathUtils.lerp(from.radius, to.radius, e),
            THREE.MathUtils.lerp(from.phi, to.phi, e),
            THREE.MathUtils.lerp(from.theta, to.theta, e),
          ),
        )
        .add(this.controls.target);
      if (p >= 1) this.tween = undefined;
      busy = true;
    }
    this.controls.update();

    const tint = new THREE.Color();
    const srgb = new THREE.Color();
    for (const key of this.keys.values()) {
      let hop = 0;
      if (key.pending && key.flipAt !== undefined && t >= key.flipAt) {
        const p = (t - key.flipAt) / 0.42;
        if (!key.flipSwapped && p >= 0.5) {
          this.paintLegend(key, key.pending.view.label, key.pending.view.kind, key.pending.sig);
          key.flipSwapped = true;
        }
        if (p >= 1) {
          key.legend.rotation.x = 0;
          key.pending = undefined;
          key.flipAt = undefined;
        } else {
          key.legend.rotation.x = (Math.sin(p * Math.PI) * Math.PI) / 2;
          hop = Math.sin(p * Math.PI) * 0.06;
        }
        busy = true;
      } else if (key.pending) {
        busy = true;
      }
      const liftTarget = (key.id === this.hover ? 0.04 : 0) + (key.id === this.selected ? 0.07 : 0);
      key.lift = THREE.MathUtils.damp(key.lift, liftTarget, 14, dt);
      key.press = THREE.MathUtils.damp(key.press, key.pressTarget, key.pressTarget > key.press ? 40 : 18, dt);
      key.inner.position.y = key.lift + hop - key.press * TRAVEL;
      if (Math.abs(key.lift - liftTarget) > 1e-3 || Math.abs(key.press - key.pressTarget) > 1e-3) busy = true;

      const before = key.led.r + key.led.g + key.led.b;
      key.led.lerp(key.target, 1 - Math.exp(-dt * 18));
      if (Math.abs(before - (key.target.r + key.target.g + key.target.b)) > 2e-3) busy = true;
      key.skirtMat.emissive.copy(key.led);
      srgb.copy(key.led).convertLinearToSRGB();
      const [r, g, b] = legendColor([srgb.r, srgb.g, srgb.b]);
      key.legendMat.color.setRGB(r, g, b, THREE.SRGBColorSpace);
      this.glows.setColorAt(key.glowIndex, tint.copy(key.led).multiplyScalar(this.glowStrength));
    }
    if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true;

    if (busy) this.renderer.render(this.scene, this.camera);
  };
}
