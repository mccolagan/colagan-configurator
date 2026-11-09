// Modèle 3D du Colagan V2 : contour Edge.Cuts du PCB (KiCad, en mm) ramené dans le repère de la disposition
// Vial (1U = 19,05 mm). La carte est réversible : la moitié gauche est le miroir de la droite.
import type { Model3D } from './index';

const UNIT_MM = 19.05;
/** Bord droit de la grille droite dans la disposition Vial (colonne extérieure en 1,5U). */
const LAYOUT_WIDTH = 18.2599;

const RIGHT_OUTLINE_MM: readonly (readonly [number, number])[] = [
  [128.37, 87.85],
  [283.32, 87.85],
  [283.32, 164.21],
  [223.12, 164.21],
  [223.12, 190.53],
  [209.55, 204.1],
  [195.98, 190.53],
  [178.44, 183.26],
  [159.45, 183.26],
  [141.93, 190.53],
  [128.37, 204.08],
  [114.79, 190.5],
  [128.38, 176.91],
];

const toLayout = ([x, y]: readonly [number, number]): [number, number] => [
  LAYOUT_WIDTH - (283.32 - x) / UNIT_MM,
  (y - 87.85) / UNIT_MM,
];
const mirror = (x: number): number => LAYOUT_WIDTH - x;

const right = RIGHT_OUTLINE_MM.map(toLayout);
const left = right.map(([x, y]): [number, number] => [mirror(x), y]).reverse();

/** Pico (droite, maître USB) et Pico W (gauche), montés au-dessus des cartes. */
const PICO_X = 10.873;
const PICO_Y = 1.358;
/** USB-C du lien série : bord intérieur de la carte droite. */
const USB_EDGE = 10.126;
const USB_Y = 3.503;
/** Trous de fixation de la carte droite. */
const HOLES: readonly (readonly [number, number])[] = [
  [17.97, 3.47],
  [17.96, 0.47],
  [10.97, 3.78],
  [14.56, 4.26],
];
const SILK = { x: 10.95, y: 2.98, lines: ['Colagan Pico Split', 'KeyBoard V.1'] } as const;

export const COLAGAN_V2_MODEL: Model3D = {
  outlines: [left, right],
  pcbColor: '#4e2163',
  boards: [
    { x: PICO_X, y: PICO_Y, label: 'Pico' },
    { x: mirror(PICO_X), y: PICO_Y, label: 'Pico W', wireless: true },
  ],
  links: [
    { edge: USB_EDGE, y: USB_Y, out: -1 },
    { edge: mirror(USB_EDGE), y: USB_Y, out: 1 },
  ],
  holes: [...HOLES, ...HOLES.map(([x, y]): [number, number] => [mirror(x), y])],
  silk: [SILK, { ...SILK, x: mirror(SILK.x) }],
};
