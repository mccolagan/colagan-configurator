import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVil } from '../io/vil';
import { KeycodeCatalog } from './catalog';

const vil = parseVil(readFileSync('tests/fixtures/colagan-v2-default.vil', 'utf8'));
const catalog = new KeycodeCatalog({
  layers: 8,
  macroCount: 16,
  tapDanceCount: 32,
  customKeycodes: [{ name: 'SEL x3', title: 'Sélecteur de couche', shortName: 'SELx3' }],
});

function allKeycodeNames(): string[] {
  const names = vil.layout.flat(2).filter((k): k is string => typeof k === 'string');
  for (const td of vil.tap_dance) names.push(...td.slice(0, 4).map(String));
  for (const combo of vil.combo) names.push(...combo);
  for (const ko of vil.key_override) names.push(ko.trigger, ko.replacement);
  for (const ar of vil.alt_repeat_key) names.push(ar.keycode, ar.alt_keycode);
  return names;
}

describe('KeycodeCatalog', () => {
  it('fait l’aller-retour nom -> valeur -> nom sur tous les keycodes de la fixture', () => {
    for (const name of allKeycodeNames()) {
      expect(catalog.serialize(catalog.deserialize(name)), name).toBe(name);
    }
  });

  it.each([
    ['KC_NO', 0x0000],
    ['KC_TRNS', 0x0001],
    ['KC_A', 0x0004],
    ['KC_BSPACE', 0x002a],
    ['KC_LSHIFT', 0x00e1],
    ['MO(1)', 0x5221],
    ['MO(4)', 0x5224],
    ['TO(0)', 0x5200],
    ['LSFT(KC_DOT)', 0x0237],
    ['USER00', 0x7e00],
    ['QK_BOOT', 0x7c00],
    ['RM_VALU', 0x7849],
  ])('%s = %i', (name, value) => {
    expect(catalog.deserialize(name)).toBe(value);
    expect(catalog.serialize(value)).toBe(name);
  });

  it('évalue les expressions comme AnyKeycode', () => {
    expect(catalog.deserialize('LT(2, KC_SPACE)')).toBe(0x4000 | (2 << 8) | 0x2c);
    expect(catalog.serialize(0x4000 | (2 << 8) | 0x2c)).toBe('LT2(KC_SPACE)');
    expect(catalog.deserialize('MT(MOD_LCTL | MOD_LSFT, KC_A)')).toBe(0x2000 | (0x03 << 8) | 0x04);
    expect(catalog.deserialize('KC_BSPC')).toBe(0x2a);
    expect(catalog.deserialize('0x5224')).toBe(0x5224);
  });

  it('écrit les valeurs inconnues en hexadécimal comme Vial', () => {
    expect(catalog.serialize(0x7e05)).toBe('0x7e05');
  });

  it('expose les libellés de la touche personnalisée', () => {
    expect(catalog.entry(0x7e00)).toMatchObject({ id: 'USER00', label: 'SELx3', group: 'user' });
  });
});
