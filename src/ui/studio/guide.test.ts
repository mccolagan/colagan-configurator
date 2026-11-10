import { describe, expect, it } from 'vitest';
import { KeycodeCatalog } from '../../keycodes/catalog';
import { GUIDE_EXAMPLES } from './guide';

const catalog = new KeycodeCatalog({ layers: 8, macroCount: 16, tapDanceCount: 32 });

describe('exemples du guide', () => {
  it.each(GUIDE_EXAMPLES)('« %s » se lit dans Keycode avancé', (code) => {
    expect(catalog.deserialize(code)).toBeGreaterThan(0);
  });

  it('donnent les keycodes annoncés', () => {
    expect(catalog.deserialize('LT(1, KC_SPC)')).toBe(0x4000 | (1 << 8) | 0x2c);
    expect(catalog.deserialize('LCTL_T(KC_ESC)')).toBe(0x2000 | (0x01 << 8) | 0x29);
    expect(catalog.deserialize('LSFT_T(KC_ENT)')).toBe(0x2000 | (0x02 << 8) | 0x28);
    expect(catalog.deserialize('MT(MOD_LCTL | MOD_LSFT, KC_TAB)')).toBe(0x2000 | (0x03 << 8) | 0x2b);
  });
});
