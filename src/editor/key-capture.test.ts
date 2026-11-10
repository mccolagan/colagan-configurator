import { describe, expect, it } from 'vitest';
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
  });

  it('touche ISO près d’Entrée : KC_NUHS en AZERTY, KC_BSLS en QWERTY', () => {
    expect(press(new KeyCapture(), ['Backslash'], true)).toBe(0x32);
    expect(press(new KeyCapture(), ['Backslash'], false)).toBe(0x31);
  });

  it('ignore les touches inconnues', () => {
    expect(new KeyCapture().down('Fn', true)).toBeUndefined();
  });
});
