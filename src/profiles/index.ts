// Profils connus, identifiés par l'UID Vial. Un clavier inconnu fonctionne avec des valeurs génériques.
import { COLAGAN_V2_MODEL } from './colagan-v2-model';

/** Habillage de la vue 3D ; sans lui, une coque rectangulaire entoure les touches. */
export interface Model3D {
  /** Contour de chaque carte (et de la coque), en unités de touche, dans le repère de la disposition KLE. */
  readonly outlines: readonly (readonly (readonly [number, number])[])[];
  /** Couleur du vernis du PCB, visible sur la tranche entre le dessus et le fond de la coque. */
  readonly pcbColor?: string;
  /** Microcontrôleurs visibles au-dessus de la coque (centre en unités de touche) ; wireless = module radio. */
  readonly boards?: readonly {
    readonly x: number;
    readonly y: number;
    readonly label: string;
    readonly wireless?: boolean;
  }[];
  /** Prises USB-C du lien entre moitiés : bord de carte (x), hauteur (y), sens de sortie du câble (-1 = vers la gauche). */
  readonly links?: readonly { readonly edge: number; readonly y: number; readonly out: -1 | 1 }[];
  /** Trous de fixation (centre), sérigraphiés sur le PCB. */
  readonly holes?: readonly (readonly [number, number])[];
  /** Texte sérigraphié sur le PCB (centre de la première ligne). */
  readonly silk?: readonly { readonly x: number; readonly y: number; readonly lines: readonly string[] }[];
}

export interface KeyboardProfile {
  readonly id: string;
  readonly layerNames: readonly string[];
  /** Couches dont les couleurs sont imposées par le firmware (ledmaps) et masquent l'effet RGB. */
  readonly ledmapLayers?: readonly number[];
  /** Keycodes propres au firmware qui font sortir d'une couche (ex. SEL x3 -> sélecteur). */
  readonly exitKeycodes?: readonly number[];
  readonly model3d?: Model3D;
}

/** Colagan V2 : VIAL_KEYBOARD_UID {0x0E, 0xDC, 0x42, 0x07, 0xFC, 0x15, 0xEE, 0xC7} lu en little-endian. */
export const COLAGAN_V2_UID = 0xc7ee15fc0742dc0en;

const COLAGAN_V2: KeyboardProfile = {
  id: 'colagan-v2',
  layerNames: ['BASE', 'FN', 'FPS', 'MMO', 'MMO UI', 'Sélecteur'],
  ledmapLayers: [2, 3, 4, 5],
  // USER00 = SEL x3 : trois appuis ouvrent le sélecteur, qui a ses TO()
  exitKeycodes: [0x7e00],
  model3d: COLAGAN_V2_MODEL,
};

export function profileFor(uid: bigint): KeyboardProfile | undefined {
  return uid === COLAGAN_V2_UID ? COLAGAN_V2 : undefined;
}

export function layerName(profile: KeyboardProfile | undefined, layer: number): string {
  return profile?.layerNames[layer] ?? String(layer);
}
