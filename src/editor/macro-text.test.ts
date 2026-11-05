import { describe, expect, it } from 'vitest';
import { colaganCatalog as catalog } from '../protocol/test-helpers';
import { hasNonAscii, textToAzertyTaps } from './macro-text';

describe('texte de macro -> frappes AZERTY', () => {
  it('choisit la touche AZERTY, Shift et AltGr compris', () => {
    const { action, missing } = textToAzertyTaps('gg wp!1@', catalog);
    expect(action).toEqual([
      'tap',
      'KC_G',
      'KC_G',
      'KC_SPACE',
      'KC_Z',
      'KC_P',
      'KC_SLASH',
      'LSFT(KC_1)',
      'RALT(KC_0)',
    ]);
    expect(missing).toEqual([]);
  });

  it('tape les majuscules et les accents français, ignore l’inconnu', () => {
    const { action, missing } = textToAzertyTaps('Aé\n☃', catalog);
    expect(action).toEqual(['tap', 'LSFT(KC_Q)', 'KC_2', 'KC_ENTER']);
    expect(missing).toEqual(['☃']);
  });

  it('repère les caractères non ASCII', () => {
    expect(hasNonAscii('abc')).toBe(false);
    expect(hasNonAscii('é')).toBe(true);
  });
});
