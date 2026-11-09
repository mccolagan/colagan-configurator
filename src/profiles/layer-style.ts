// Habillage des couches dans l'interface : teinte, description courte, raccourci « trois appuis ».
import type { KeyboardProfile } from './index';

interface LayerStyle {
  readonly tints: readonly string[];
  readonly descriptions: readonly string[];
  /** Keycode personnalisé qui ouvre une couche après trois appuis rapides (SEL x3 du Colagan). */
  readonly tripleTap?: { readonly code: number; readonly layer: number; readonly label: string };
}

const STYLES: Record<string, LayerStyle> = {
  'colagan-v2': {
    tints: ['#8E8E93', '#FF9F0A', '#FF453A', '#0A84FF', '#30D158', '#BF5AF2', '#AEAEB2', '#AEAEB2'],
    descriptions: [
      'Frappe normale',
      'F1–F12, flèches, médias',
      'Warzone',
      'WoW Forever',
      'F1–F5, fenêtres du jeu',
      'Couches, RGB, bootloader',
      'Libre',
      'Libre',
    ],
    tripleTap: { code: 0x7e00, layer: 5, label: 'SEL ×3' },
  },
};

const DEFAULT_TINTS = [
  '#8E8E93',
  '#FF9F0A',
  '#0A84FF',
  '#30D158',
  '#BF5AF2',
  '#FF453A',
  '#64D2FF',
  '#FFD60A',
];

export function layerTint(profile: KeyboardProfile | undefined, layer: number): string {
  const tints = (profile && STYLES[profile.id]?.tints) ?? DEFAULT_TINTS;
  return tints[layer] ?? DEFAULT_TINTS[layer % DEFAULT_TINTS.length] ?? '#8E8E93';
}

export function layerDescription(profile: KeyboardProfile | undefined, layer: number): string | undefined {
  return profile ? STYLES[profile.id]?.descriptions[layer] : undefined;
}

export function tripleTap(profile: KeyboardProfile | undefined): LayerStyle['tripleTap'] {
  return profile ? STYLES[profile.id]?.tripleTap : undefined;
}
