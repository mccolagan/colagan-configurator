import { decodeDefinition, type VialDefinition } from './definition';
import { ProtocolError, type Transport } from './packet';
import * as via from './via';
import * as vial from './vial';
import * as vialrgb from './vialrgb';

export interface KeyboardInfo {
  readonly viaProtocol: number;
  readonly vialProtocol: number;
  readonly uid: bigint;
  readonly definition: VialDefinition;
  readonly layers: number;
  readonly rows: number;
  readonly cols: number;
  readonly dynamic: vial.DynamicCounts;
  readonly macroCount: number;
  readonly macroBufferSize: number;
  readonly rgb?: {
    readonly info: vialrgb.RgbInfo;
    readonly supportedEffects: readonly number[];
    /** Mode lu à la connexion : sert à « Rétablir » (l'EEPROM n'est pas relisible). */
    readonly initialMode: vialrgb.RgbMode;
  };
}

/** Protocole Vial supporté (vial-qmk de novembre 2025). */
export const SUPPORTED_VIAL_PROTOCOL = 6;

export class KeyboardClient {
  private constructor(
    readonly transport: Transport,
    readonly info: KeyboardInfo,
    private readonly keymap: Uint16Array,
  ) {}

  /** Lit tout ce qui est nécessaire à l'affichage, dans l'ordre de Vial. */
  static async connect(transport: Transport): Promise<KeyboardClient> {
    const viaProtocol = await via.getProtocolVersion(transport);
    const id = await vial.getKeyboardId(transport);
    if (id.protocol !== SUPPORTED_VIAL_PROTOCOL) {
      throw new ProtocolError(
        `Protocole Vial ${String(id.protocol)} non pris en charge (attendu : ${String(SUPPORTED_VIAL_PROTOCOL)})`,
      );
    }
    const definition = await decodeDefinition(await vial.readCompressedDefinition(transport));
    const layers = await via.getLayerCount(transport);
    const { rows, cols } = definition.matrix;
    const keymap = await via.readKeymap(transport, layers, rows, cols);
    const dynamic = await vial.getDynamicCounts(transport);
    const macroCount = await via.getMacroCount(transport);
    const macroBufferSize = await via.getMacroBufferSize(transport);

    let rgb: KeyboardInfo['rgb'];
    if (id.vialRgb) {
      rgb = {
        info: await vialrgb.getRgbInfo(transport),
        supportedEffects: await vialrgb.getSupportedEffects(transport),
        initialMode: await vialrgb.getRgbMode(transport),
      };
    }

    const info: KeyboardInfo = {
      viaProtocol,
      vialProtocol: id.protocol,
      uid: id.uid,
      definition,
      layers,
      rows,
      cols,
      dynamic,
      macroCount,
      macroBufferSize,
      ...(rgb ? { rgb } : {}),
    };
    return new KeyboardClient(transport, info, keymap);
  }

  private index(layer: number, row: number, col: number): number {
    const { layers, rows, cols } = this.info;
    if (layer >= layers || row >= rows || col >= cols) {
      throw new RangeError(`Position hors matrice : ${String(layer)}/${String(row)}/${String(col)}`);
    }
    return (layer * rows + row) * cols + col;
  }

  getKey(layer: number, row: number, col: number): number {
    return this.keymap[this.index(layer, row, col)] ?? 0;
  }

  /** Copie de la keymap en cache [couche][ligne][colonne] aplatie. */
  snapshot(): Uint16Array {
    return this.keymap.slice();
  }

  /**
   * Écrit une touche puis la relit : le firmware peut remplacer la valeur (QK_BOOT -> KC_NO si verrouillé).
   * Renvoie la valeur réellement enregistrée.
   */
  async setKey(layer: number, row: number, col: number, keycode: number): Promise<number> {
    const i = this.index(layer, row, col);
    await via.setKeycode(this.transport, layer, row, col, keycode);
    const stored = await via.getKeycode(this.transport, layer, row, col);
    this.keymap[i] = stored;
    return stored;
  }

  async reloadKeymap(): Promise<void> {
    const { layers, rows, cols } = this.info;
    this.keymap.set(await via.readKeymap(this.transport, layers, rows, cols));
  }
}
