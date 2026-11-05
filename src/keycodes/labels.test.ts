import { describe, expect, it } from 'vitest';
import { colaganCatalog as catalog } from '../protocol/test-helpers';
import { azertySearchChars, keyLabel } from './labels';

const azerty = (name: string) => keyLabel(catalog, catalog.deserialize(name), 'azerty');

describe('étiquettes AZERTY', () => {
  it('permute les lettres et la rangée du bas comme un clavier français', () => {
    expect(azerty('KC_Q').main).toBe('A');
    expect(azerty('KC_W').main).toBe('Z');
    expect(azerty('KC_A').main).toBe('Q');
    expect(azerty('KC_SCOLON').main).toBe('M');
    expect(azerty('KC_M')).toEqual({ main: ',', shift: '?' });
    expect(azerty('KC_SLASH')).toEqual({ main: '!', shift: '§' });
  });

  it('affiche la rangée des chiffres avec Shift et AltGr', () => {
    expect(azerty('KC_2')).toEqual({ main: 'é', shift: '2', altgr: '~' });
    expect(azerty('KC_0')).toEqual({ main: 'à', shift: '0', altgr: '@' });
    expect(azerty('KC_QUOTE')).toEqual({ main: 'ù', shift: '%' });
    expect(azerty('KC_GRAVE')).toEqual({ main: '²' });
    expect(azerty('KC_E')).toEqual({ main: 'E', altgr: '€' });
  });

  it('donne le caractère tapé pour LSFT(kc) et RALT(kc)', () => {
    expect(azerty('LSFT(KC_1)').main).toBe('1');
    expect(azerty('RALT(KC_0)').main).toBe('@');
  });

  it('remplace la touche interne des keycodes masqués', () => {
    expect(azerty('LT2(KC_Q)').main).toBe('LT 2\nA');
    expect(azerty('LCTL(KC_Z)').main).toContain('W');
  });

  it('garde les libellés Vial pour le reste et en mode QWERTY', () => {
    expect(azerty('KC_ENTER').main).toBe('Enter');
    expect(azerty('MO(1)').main).toBe('MO(1)');
    expect(keyLabel(catalog, catalog.deserialize('KC_Q'), 'qwerty').main).toBe('Q');
  });

  it('expose les caractères pour la recherche', () => {
    expect(azertySearchChars(catalog.deserialize('KC_QUOTE'))).toContain('ù');
  });
});
