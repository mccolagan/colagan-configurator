// Clavier Vial simulé en mémoire : sert aux tests unitaires, aux tests E2E et au mode démo.
// Réponses calquées sur le Colagan V2 réel (relevées le 05/11/2026) : VIA 9, Vial 6, VialRGB 1, max 64.
import { cie, LED_STREAM_COMMAND } from './led-stream';
import { readU16be, readU16le, REPORT_SIZE, u16be, u16le, type Transport } from './packet';
import { QSID_WIDTHS } from './qmk-settings';
import { ViaCommand } from './via';
import { DynamicEntryOp, VialCommand } from './vial';

export interface FakeKeyboardOptions {
  /** Définition compressée (XZ), telle que renvoyée par le firmware. */
  readonly definition: Uint8Array;
  readonly uid: bigint;
  readonly layers: number;
  readonly rows: number;
  readonly cols: number;
  /** Keymap initiale [couche][ligne][colonne] aplatie. */
  readonly keymap?: Uint16Array;
  readonly supportedEffects?: readonly number[];
  readonly maxBrightness?: number;
  readonly unlockKeys?: readonly (readonly [number, number])[];
  readonly macroCount?: number;
  readonly macroBufferSize?: number;
  readonly dynamicEntries?: number;
  /** Réglages QMK gérés (qsid -> valeur) ; par défaut ceux du Colagan V2. */
  readonly settings?: ReadonlyMap<number, number>;
  /** Commande LED 0xC0 (firmware du 05/11/2026) ; false = ancien firmware. Défaut : true. */
  readonly ledStream?: boolean;
  /** Horloge (ms) des effets animés simulés ; défaut performance.now. */
  readonly clock?: () => number;
}

/** LED -> [ligne, colonne] du Colagan V2 : chaîne linéaire, 6 colonnes, 5 pouces par moitié. */
export function colaganLedPositions(): [number, number][] {
  const positions: [number, number][] = [];
  for (const offset of [0, 5]) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < (row === 4 ? 5 : 6); col++) positions.push([offset + row, col]);
    }
  }
  return positions;
}

const LED_LEFT_COUNT = 29;

/** HSV QMK (0-255) -> RGB, sans courbe : v est déjà la valeur PWM maximale. */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const region = Math.floor(h / 43) % 6;
  const rem = (h - region * 43) * 6;
  const p = (v * (255 - s)) >> 8;
  const q = (v * (255 - ((s * rem) >> 8))) >> 8;
  const t = (v * (255 - ((s * (255 - rem)) >> 8))) >> 8;
  return (
    [
      [v, t, p],
      [q, v, p],
      [p, v, t],
      [p, q, v],
      [t, p, v],
      [v, p, q],
    ] as const
  )[region] as [number, number, number];
}

/** Réglages QMK du Colagan V2 réel (qsid 8 non géré par le firmware). */
export const COLAGAN_SETTINGS: ReadonlyMap<number, number> = new Map([
  [1, 0],
  [2, 50],
  [3, 0],
  [4, 175],
  [5, 5],
  [6, 5000],
  [7, 200],
  [9, 10],
  [10, 20],
  [11, 8],
  [12, 10],
  [13, 30],
  [14, 10],
  [15, 80],
  [16, 8],
  [17, 40],
  [18, 0],
  [19, 80],
  [20, 5],
  [21, 0],
  [22, 0],
  [23, 0],
  [24, 0],
  [25, 200],
  [26, 0],
  [27, 0],
]);

const settingWidth = (qsid: number): number => QSID_WIDTHS.get(qsid) ?? 1;

export const COLAGAN_SUPPORTED_EFFECTS = [
  1, 2, 3, 5, 6, 13, 14, 15, 16, 17, 19, 20, 23, 24, 25, 28, 29, 30, 31, 34, 41, 42, 43,
] as const;

const UNLOCK_COUNTER_MAX = 50;

export class FakeKeyboard implements Transport {
  readonly keymap: Uint16Array;
  readonly macroBuffer: Uint8Array;
  readonly tapDance: Uint8Array[];
  readonly combos: Uint8Array[];
  readonly keyOverrides: Uint8Array[];
  readonly altRepeatKeys: Uint8Array[];
  readonly settings: Map<number, number>;
  rgb = { effect: 14, speed: 60, hue: 0, saturation: 255, value: 40 };
  savedRgb = { ...this.rgb };
  unlocked = false;
  /** Simule les touches de déverrouillage tenues par l'utilisateur. */
  holdingUnlockKeys = false;
  inBootloader = false;
  /** Simule un lien split coupé : les LED de la gauche (esclave) deviennent inconnues. */
  remoteConnected = true;
  readonly ledPositions = colaganLedPositions();
  /** Rapports reçus, pour les assertions des tests. */
  readonly sent: Uint8Array[] = [];
  private unlockInProgress = false;
  private unlockCounter = UNLOCK_COUNTER_MAX;

  constructor(private readonly options: FakeKeyboardOptions) {
    const size = options.layers * options.rows * options.cols;
    this.keymap = options.keymap ? Uint16Array.from(options.keymap) : new Uint16Array(size);
    if (this.keymap.length !== size) throw new Error('Keymap de taille incohérente');
    this.macroBuffer = new Uint8Array(options.macroBufferSize ?? 1903);
    const entries = options.dynamicEntries ?? 32;
    const tdDefault = new Uint8Array(10);
    tdDefault.set(u16le(200), 8);
    this.tapDance = Array.from({ length: entries }, () => tdDefault.slice());
    this.combos = Array.from({ length: entries }, () => new Uint8Array(10));
    // valeurs par défaut du firmware : toutes les couches (0xFFFF), options 7 (relevées sur le vrai clavier)
    this.keyOverrides = Array.from({ length: entries }, () =>
      Uint8Array.from([0, 0, 0, 0, 0xff, 0xff, 0, 0, 0, 7]),
    );
    this.altRepeatKeys = Array.from({ length: entries }, () => new Uint8Array(6));
    this.settings = new Map(options.settings ?? COLAGAN_SETTINGS);
  }

  private index(layer: number, row: number, col: number): number {
    return (layer * this.options.rows + row) * this.options.cols + col;
  }

  request(report: Uint8Array): Promise<Uint8Array> {
    this.sent.push(report.slice());
    const msg = new Uint8Array(REPORT_SIZE);
    msg.set(report.subarray(0, REPORT_SIZE));
    const [command = 0] = msg;
    switch (command) {
      case ViaCommand.getProtocolVersion:
        msg.set(u16be(9), 1);
        break;
      case ViaCommand.getLayerCount:
        msg[1] = this.options.layers;
        break;
      case ViaCommand.getKeycode: {
        const [, layer = 0, row = 0, col = 0] = msg;
        msg.set(u16be(this.keymap[this.index(layer, row, col)] ?? 0), 4);
        break;
      }
      case ViaCommand.setKeycode: {
        const [, layer = 0, row = 0, col = 0] = msg;
        this.keymap[this.index(layer, row, col)] = this.firewall(readU16be(msg, 4));
        break;
      }
      case ViaCommand.keymapReset:
        this.keymap.fill(0);
        break;
      case ViaCommand.keymapGetBuffer:
      case ViaCommand.keymapSetBuffer:
        this.keymapBuffer(msg, command === ViaCommand.keymapSetBuffer);
        break;
      case ViaCommand.macroGetCount:
        msg[1] = this.options.macroCount ?? 16;
        break;
      case ViaCommand.macroGetBufferSize:
        msg.set(u16be(this.macroBuffer.length), 1);
        break;
      case ViaCommand.macroGetBuffer:
        this.buffer(this.macroBuffer, msg, false);
        break;
      case ViaCommand.macroSetBuffer:
        if (!this.unlocked) msg[0] = ViaCommand.unhandled;
        else this.buffer(this.macroBuffer, msg, true);
        break;
      case ViaCommand.lightingGetValue:
        this.rgbGet(msg);
        break;
      case ViaCommand.lightingSetValue:
        if (msg[1] === 0x41) {
          this.rgb = {
            effect: readU16le(msg, 2),
            speed: msg[4] ?? 0,
            hue: msg[5] ?? 0,
            saturation: msg[6] ?? 0,
            value: Math.min(msg[7] ?? 0, this.options.maxBrightness ?? 64),
          };
        }
        break;
      case ViaCommand.lightingSave:
        this.savedRgb = { ...this.rgb };
        break;
      case ViaCommand.eepromReset:
        this.keymap.fill(0);
        this.macroBuffer.fill(0);
        break;
      case ViaCommand.bootloaderJump:
        if (!this.unlocked) msg[0] = ViaCommand.unhandled;
        else this.inBootloader = true;
        break;
      case ViaCommand.vialPrefix:
        this.vial(msg);
        break;
      case LED_STREAM_COMMAND:
        if (this.options.ledStream === false) msg[0] = ViaCommand.unhandled;
        else if (!this.unlockInProgress) this.ledStream(msg);
        break;
      default:
        msg[0] = ViaCommand.unhandled;
    }
    return Promise.resolve(msg);
  }

  /** Couleur simulée d'une LED : éteinte, unie, ou arc-en-ciel animé pour les autres effets. */
  ledColor(led: number): [number, number, number] {
    const { effect, speed, hue, saturation, value } = this.rgb;
    if (effect === 0) return [0, 0, 0];
    const peak = cie(value);
    if (effect === 2) return hsvToRgb(hue, saturation, peak);
    const [, col = 0] = this.ledPositions[led] ?? [];
    const x = led < LED_LEFT_COUNT ? col : 11 - col;
    const time = (this.options.clock ?? (() => performance.now()))();
    return hsvToRgb(Math.floor(hue + x * 20 + (time * (speed + 16)) / 200) & 0xff, saturation, peak);
  }

  /** Réponses de led_stream.c (droite maître). */
  private ledStream(msg: Uint8Array): void {
    const [, sub = 0, marker = 0, start = 0] = msg;
    const count = this.ledPositions.length;
    msg.fill(0, 2);
    msg[3] = start;
    if (marker !== 0xff) {
      msg[2] = 0x03;
      return;
    }
    if (sub === 0) {
      const flags = 0x01 | (this.remoteConnected ? 0x02 : 0) | (this.rgb.effect ? 0x04 : 0);
      msg.set(
        [1, count, 9, 13, LED_LEFT_COUNT, 1, flags, this.options.maxBrightness ?? 64, this.rgb.value, 10, 6],
        3,
      );
      return;
    }
    if (sub !== 1 && sub !== 2) {
      msg[2] = 0x01;
      return;
    }
    if (start >= count) {
      msg[2] = 0x02;
      return;
    }
    const n = Math.min(sub === 1 ? 13 : 9, count - start);
    msg[4] = n;
    for (let i = 0; i < n; i++) {
      const led = start + i;
      if (sub === 1) {
        msg.set(this.ledPositions[led] ?? [0xff, 0xff], 5 + 2 * i);
      } else if (led < LED_LEFT_COUNT && !this.remoteConnected) {
        msg[2] = 0x10;
      } else {
        msg.set(this.ledColor(led), 5 + 3 * i);
      }
    }
  }

  /** Comme vial_keycode_firewall : QK_BOOT refusé tant que le clavier est verrouillé. */
  private firewall(keycode: number): number {
    return keycode === 0x7c00 && !this.unlocked ? 0 : keycode;
  }

  private keymapBuffer(msg: Uint8Array, write: boolean): void {
    const offset = readU16be(msg, 1);
    const size = msg[3] ?? 0;
    for (let i = 0; i < size; i += 2) {
      const index = (offset + i) / 2;
      if (write) this.keymap[index] = this.firewall(readU16be(msg, 4 + i));
      else msg.set(u16be(this.keymap[index] ?? 0), 4 + i);
    }
  }

  private buffer(target: Uint8Array, msg: Uint8Array, write: boolean): void {
    const offset = readU16be(msg, 1);
    const size = msg[3] ?? 0;
    if (write) target.set(msg.subarray(4, 4 + size), offset);
    else msg.set(target.subarray(offset, offset + size), 4);
  }

  private rgbGet(msg: Uint8Array): void {
    switch (msg[1]) {
      case 0x40:
        msg.set([...u16le(1), this.options.maxBrightness ?? 64], 2);
        break;
      case 0x41:
        msg.set(
          [...u16le(this.rgb.effect), this.rgb.speed, this.rgb.hue, this.rgb.saturation, this.rgb.value],
          2,
        );
        break;
      case 0x42: {
        const greaterThan = readU16le(msg, 2);
        msg.fill(0xff, 2);
        const ids = (this.options.supportedEffects ?? COLAGAN_SUPPORTED_EFFECTS).filter(
          (id) => id > greaterThan,
        );
        ids.slice(0, (REPORT_SIZE - 2) / 2).forEach((id, i) => {
          msg.set(u16le(id), 2 + i * 2);
        });
        break;
      }
    }
  }

  private vial(msg: Uint8Array): void {
    const sub = msg[1];
    switch (sub) {
      case VialCommand.getKeyboardId: {
        msg.fill(0);
        msg.set([6, 0, 0, 0], 0);
        let uid = this.options.uid;
        for (let i = 0; i < 8; i++) {
          msg[4 + i] = Number(uid & 0xffn);
          uid >>= 8n;
        }
        msg[12] = 1;
        break;
      }
      case VialCommand.getSize:
        msg.set([...u16le(this.options.definition.length), 0, 0], 0);
        break;
      case VialCommand.getDefinition: {
        const start = readU16le(msg, 2) * REPORT_SIZE;
        if (start >= this.options.definition.length) return;
        msg.set(this.options.definition.subarray(start, start + REPORT_SIZE), 0);
        break;
      }
      case VialCommand.getUnlockStatus: {
        msg.fill(0xff);
        msg[0] = this.unlocked ? 1 : 0;
        msg[1] = this.unlockInProgress ? 1 : 0;
        (
          this.options.unlockKeys ?? [
            [5, 5],
            [8, 5],
          ]
        ).forEach(([row, col], i) => {
          msg.set([row, col], 2 + i * 2);
        });
        break;
      }
      case VialCommand.unlockStart:
        this.unlockInProgress = true;
        this.unlockCounter = UNLOCK_COUNTER_MAX;
        break;
      case VialCommand.unlockPoll:
        if (this.unlockInProgress) {
          if (this.holdingUnlockKeys) {
            this.unlockCounter--;
            if (this.unlockCounter === 0) {
              this.unlockInProgress = false;
              this.unlocked = true;
            }
          } else {
            this.unlockCounter = UNLOCK_COUNTER_MAX;
          }
        }
        msg.set([this.unlocked ? 1 : 0, this.unlockInProgress ? 1 : 0, this.unlockCounter], 0);
        break;
      case VialCommand.lock:
        this.unlocked = false;
        break;
      case VialCommand.dynamicEntryOp:
        this.dynamic(msg);
        break;
      case VialCommand.qmkSettingsQuery: {
        const after = readU16le(msg, 2);
        const ids = [...this.settings.keys()].filter((q) => q > after).sort((a, b) => a - b);
        msg.fill(0xff);
        ids.slice(0, REPORT_SIZE / 2).forEach((q, i) => {
          msg.set(u16le(q), i * 2);
        });
        break;
      }
      case VialCommand.qmkSettingsGet: {
        const qsid = readU16le(msg, 2);
        const value = this.settings.get(qsid);
        msg.fill(0);
        if (value === undefined) {
          msg[0] = 1;
          break;
        }
        for (let i = 0; i < settingWidth(qsid); i++) msg[1 + i] = Math.floor(value / 256 ** i) % 256;
        break;
      }
      case VialCommand.qmkSettingsSet: {
        const qsid = readU16le(msg, 2);
        if (!this.settings.has(qsid)) {
          msg[0] = 1;
          break;
        }
        let value = 0;
        for (let i = settingWidth(qsid) - 1; i >= 0; i--) value = value * 256 + (msg[4 + i] ?? 0);
        this.settings.set(qsid, value);
        msg[0] = 0;
        break;
      }
      default:
        msg.fill(0xff);
    }
  }

  private dynamic(msg: Uint8Array): void {
    const op = msg[2];
    const index = msg[3] ?? 0;
    const tables: Record<number, [Uint8Array[], boolean]> = {
      [DynamicEntryOp.tapDanceGet]: [this.tapDance, false],
      [DynamicEntryOp.tapDanceSet]: [this.tapDance, true],
      [DynamicEntryOp.comboGet]: [this.combos, false],
      [DynamicEntryOp.comboSet]: [this.combos, true],
      [DynamicEntryOp.keyOverrideGet]: [this.keyOverrides, false],
      [DynamicEntryOp.keyOverrideSet]: [this.keyOverrides, true],
      [DynamicEntryOp.altRepeatKeyGet]: [this.altRepeatKeys, false],
      [DynamicEntryOp.altRepeatKeySet]: [this.altRepeatKeys, true],
    };
    if (op === DynamicEntryOp.getCounts) {
      const n = this.options.dynamicEntries ?? 32;
      msg.fill(0);
      msg.set([n, n, n, n], 0);
      msg[REPORT_SIZE - 1] = 0x03;
      return;
    }
    const table = op === undefined ? undefined : tables[op];
    const entry = table?.[0][index];
    if (!table || !entry) {
      msg[0] = 1;
      return;
    }
    if (table[1]) {
      entry.set(msg.subarray(4, 4 + entry.length));
      msg[0] = 0;
    } else {
      msg.fill(0);
      msg.set(entry, 1);
    }
  }
}
