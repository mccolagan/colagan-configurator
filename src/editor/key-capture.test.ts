import { describe, expect, it } from 'vitest';
import { KeycodeCatalog } from '../keycodes/catalog';
import { KeyCapture } from './key-capture';

function press(capture: KeyCapture, codes: string[], iso = true): number | undefined {
  let result: number | undefined;
  for (const code of codes) result = capture.down(code, iso) ?? result;
  for (const code of [...codes].reverse()) result = capture.up(code) ?? result;
  return result;
}

describe('capture d’une touche du clavier', () => {
  it('donne le keycode de base de la position (AZERTY : la touche A est KC_Q)', () => {
    expect(press(new KeyCapture(), ['KeyQ'])).toBe(0x14);
    expect(press(new KeyCapture(), ['Digit1'])).toBe(0x1e);
    expect(press(new KeyCapture(), ['F5'])).toBe(0x3e);
  });

  it('ajoute les modificateurs tenus', () => {
    expect(press(new KeyCapture(), ['ShiftLeft', 'Digit1'])).toBe(0x0200 | 0x1e);
    expect(press(new KeyCapture(), ['ControlLeft', 'ShiftLeft', 'Escape'])).toBe(0x0300 | 0x29);
    expect(press(new KeyCapture(), ['ControlRight', 'KeyC'])).toBe(0x1100 | 0x06);
  });

  it('AltGr seul compte, même avec le Ctrl gauche ajouté par Windows', () => {
    expect(press(new KeyCapture(), ['ControlLeft', 'AltRight', 'Digit0'])).toBe(0x1400 | 0x27);
  });

  it('un modificateur appuyé puis relâché seul donne sa touche', () => {
    expect(press(new KeyCapture(), ['ShiftLeft'])).toBe(0xe1);
    expect(press(new KeyCapture(), ['AltRight'])).toBe(0xe6);
    expect(press(new KeyCapture(), ['ControlLeft', 'AltRight'])).toBe(0xe6);
  });

  it('plusieurs modificateurs seuls : le dernier sert de touche, Ctrl + Maj -> LCTL(KC_LSFT)', () => {
    expect(press(new KeyCapture(), ['ControlLeft', 'ShiftLeft'])).toBe(0x0100 | 0xe1);
    expect(press(new KeyCapture(), ['ControlLeft', 'ShiftLeft', 'AltLeft'])).toBe(0x0300 | 0xe2);
    expect(press(new KeyCapture(), ['ControlRight', 'ShiftRight'])).toBe(0x1100 | 0xe5);
    expect(new KeycodeCatalog({ layers: 8, macroCount: 16, tapDanceCount: 32 }).serialize(0x01e1)).toBe(
      'LCTL(KC_LSHIFT)',
    );
  });

  it('rien tant qu’un modificateur reste tenu, et rien au relâchement après une touche', () => {
    const capture = new KeyCapture();
    expect(capture.down('ControlLeft', true)).toBeUndefined();
    expect(capture.down('ShiftLeft', true)).toBeUndefined();
    expect(capture.up('ShiftLeft')).toBeUndefined();
    expect(capture.down('KeyA', true)).toBe(0x0100 | 0x04);
    expect(capture.up('KeyA')).toBeUndefined();
    expect(capture.up('ControlLeft')).toBeUndefined();
  });

  it('touche ISO près d’Entrée : KC_NUHS en AZERTY, KC_BSLS en QWERTY', () => {
    expect(press(new KeyCapture(), ['Backslash'], true)).toBe(0x32);
    expect(press(new KeyCapture(), ['Backslash'], false)).toBe(0x31);
  });

  it('ignore les touches inconnues', () => {
    expect(new KeyCapture().down('Fn', true)).toBeUndefined();
  });
});
