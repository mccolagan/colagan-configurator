// Étiquettes affichées sur les touches : caractères AZERTY FR (défaut) ou libellés Vial (QWERTY / noms QMK).
import { azertyChars, azertyOutput } from './azerty';
import type { KeycodeCatalog } from './catalog';

export type LabelLayout = 'azerty' | 'qwerty';

export interface KeyLabel {
  readonly main: string;
  readonly shift?: string;
  readonly altgr?: string;
}

export function keyLabel(catalog: KeycodeCatalog, code: number, layout: LabelLayout): KeyLabel {
  if (layout === 'azerty') {
    const chars = azertyChars(code);
    if (chars) {
      const { base, shift, altgr } = chars;
      // lettre : on n'affiche que la majuscule, comme sur un clavier physique
      if (shift !== undefined && shift === base.toUpperCase() && shift !== base) {
        return altgr ? { main: shift, altgr } : { main: shift };
      }
      return { main: base, ...(shift ? { shift } : {}), ...(altgr ? { altgr } : {}) };
    }
    const typed = azertyOutput(code);
    if (typed) return { main: typed };
    const parts = catalog.masked(code);
    if (parts) {
      const inner = keyLabel(catalog, parts.inner, layout).main;
      return { main: parts.outer.label.replace('(kc)', inner) };
    }
  }
  return { main: catalog.label(code) };
}

/** Texte sur une ligne (boutons, lecteurs d'écran). */
export function flatLabel(label: KeyLabel): string {
  return label.main.replaceAll('\n', ' ');
}

/** Caractères AZERTY d'une touche de base, pour la recherche (« ù » trouve KC_QUOTE). */
export function azertySearchChars(code: number): readonly string[] {
  const chars = azertyChars(code);
  return chars ? [chars.base, chars.shift, chars.altgr].filter((c): c is string => c !== undefined) : [];
}
