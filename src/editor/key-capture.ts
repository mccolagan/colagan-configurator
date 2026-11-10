// Capture d'une touche tapée sur le clavier de l'ordinateur : touche + modificateurs tenus -> keycode QMK.
// Ex. : Maj + 1 -> LSFT(KC_1), AltGr + 0 -> RALT(KC_0), Ctrl seul (appuyé puis relâché) -> KC_LCTL.
import { hidUsages } from './hid-usage';

// Octet haut des keycodes « modificateurs + touche » (0x0100-0x1FFF) : Ctrl, Maj, Alt, GUI, et le bit « droite ».
const CTRL = 0x01;
const SHIFT = 0x02;
const ALT = 0x04;
const GUI = 0x08;
const RIGHT = 0x10;

interface Modifier {
  readonly bit: number;
  readonly right: boolean;
  /** Keycode de la touche elle-même (KC_LCTL…). */
  readonly usage: number;
}

const MODIFIERS: Record<string, Modifier> = {
  ControlLeft: { bit: CTRL, right: false, usage: 0xe0 },
  ShiftLeft: { bit: SHIFT, right: false, usage: 0xe1 },
  AltLeft: { bit: ALT, right: false, usage: 0xe2 },
  MetaLeft: { bit: GUI, right: false, usage: 0xe3 },
  ControlRight: { bit: CTRL, right: true, usage: 0xe4 },
  ShiftRight: { bit: SHIFT, right: true, usage: 0xe5 },
  AltRight: { bit: ALT, right: true, usage: 0xe6 },
  MetaRight: { bit: GUI, right: true, usage: 0xe7 },
};

export class KeyCapture {
  private readonly held = new Set<string>();
  /**
   * Modificateurs appuyés sans autre touche depuis le début de l'accord : affectés quand tout est relâché.
   * Ctrl seul -> KC_LCTL ; Ctrl + Maj -> LCTL(KC_LSFT), qui tient Ctrl et Maj tant que la touche est enfoncée.
   */
  private chord: string[] = [];
  private chordHasKey = false;

  /**
   * Touche enfoncée : keycode à affecter, ou undefined (modificateur en attente, touche inconnue).
   * `iso` : la touche près d'Entrée (event.code « Backslash ») est KC_NUHS sur un clavier ISO (AZERTY).
   */
  down(code: string, iso: boolean): number | undefined {
    if (!this.held.size) {
      this.chord = [];
      this.chordHasKey = false;
    }
    if (MODIFIERS[code]) {
      this.held.add(code);
      if (!this.chord.includes(code)) this.chord.push(code);
      return undefined;
    }
    this.chordHasKey = true;
    const usages = hidUsages(code);
    const usage = iso ? usages[usages.length - 1] : usages[0];
    if (usage === undefined) return undefined;
    return (mask(this.modifiers([...this.held])) << 8) | usage;
  }

  /** Touche relâchée : quand tout est relâché, les modificateurs appuyés seuls (un ou plusieurs). */
  up(code: string): number | undefined {
    this.held.delete(code);
    if (this.held.size || this.chordHasKey || !this.chord.length) return undefined;
    const chord = this.modifiers(this.chord);
    this.chord = [];
    // le dernier appuyé sert de touche, les autres de modificateurs : Ctrl puis Maj -> LCTL(KC_LSFT)
    const last = chord.at(-1);
    if (!last) return undefined;
    return (mask(chord.slice(0, -1)) << 8) | last.usage;
  }

  reset(): void {
    this.held.clear();
    this.chord = [];
    this.chordHasKey = false;
  }

  /** Modificateurs de la liste ; AltGr (Ctrl gauche + Alt droit sous Windows) devient RALT seul. */
  private modifiers(codes: readonly string[]): Modifier[] {
    const altGr = codes.includes('AltRight');
    return codes.flatMap((code) => {
      const modifier = MODIFIERS[code];
      return modifier && !(altGr && code === 'ControlLeft') ? [modifier] : [];
    });
  }
}

/** Masque QMK (octet haut) ; QMK n'a qu'un bit « droite » pour tous : droite seulement s'ils sont tous à droite. */
function mask(list: readonly Modifier[]): number {
  if (!list.length) return 0;
  const right = list.every((m) => m.right);
  return list.reduce((bits, m) => bits | m.bit, 0) | (right ? RIGHT : 0);
}
