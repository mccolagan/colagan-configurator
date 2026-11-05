// Texte de macro : QMK l'envoie comme sur un clavier US (send_string). Sur un OS en AZERTY, « a » devient « q » :
// on propose de le convertir en frappes de keycodes calculées pour l'AZERTY.
import { azertyKeycodeFor } from '../keycodes/azerty';
import type { KeycodeCatalog } from '../keycodes/catalog';
import type { MacroAction } from '../protocol/macro';

export interface AzertyConversion {
  readonly action: MacroAction;
  /** Caractères sans touche AZERTY connue (ignorés). */
  readonly missing: readonly string[];
}

export function textToAzertyTaps(text: string, catalog: KeycodeCatalog): AzertyConversion {
  const names: string[] = [];
  const missing: string[] = [];
  for (const char of text) {
    const code = azertyKeycodeFor(char);
    if (code === undefined) missing.push(char);
    else names.push(catalog.serialize(code));
  }
  return { action: ['tap', ...names], missing };
}

/** Octets non ASCII : QMK ne sait pas les taper via le texte d'une macro. */
export function hasNonAscii(text: string): boolean {
  return Array.from(text).some((c) => (c.codePointAt(0) ?? 0) > 0x7e);
}
