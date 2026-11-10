// Capture d'une touche tapée sur le clavier de l'ordinateur : touche + modificateurs tenus -> keycode QMK.
// Ex. : Maj + 1 -> LSFT(KC_1), AltGr + 0 -> RALT(KC_0), Ctrl seul (appuyé puis relâché) -> KC_LCTL.
import { hidUsages } from './hid-usage';

// Octet haut des keycodes « modificateurs + touche » (0x0100-0x1FFF) : Ctrl, Maj, Alt, GUI, et le bit « droite ».
const CTRL = 0x01;
const SHIFT = 0x02;
const ALT = 0x04;
const GUI = 0x08;
const RIGHT = 0x10;

const MODIFIERS: Record<string, { readonly bit: number; readonly right: boolean; readonly usage: number }> = {
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
  /** Modificateur appuyé seul : affecté à son relâchement si aucune autre touche n'est venue entre-temps. */
  private lone: string | undefined;

  /**
   * Touche enfoncée : keycode à affecter, ou undefined (modificateur en attente, touche inconnue).
   * `iso` : la touche près d'Entrée (event.code « Backslash ») est KC_NUHS sur un clavier ISO (AZERTY).
   */
  down(code: string, iso: boolean): number | undefined {
    if (MODIFIERS[code]) {
      this.lone = this.held.size ? undefined : code;
      this.held.add(code);
      return undefined;
    }
    this.lone = undefined;
    const usages = hidUsages(code);
    const usage = iso ? usages[usages.length - 1] : usages[0];
    if (usage === undefined) return undefined;
    return (this.mods() << 8) | usage;
  }

  /** Touche relâchée : keycode du modificateur s'il a été appuyé seul. */
  up(code: string): number | undefined {
    const modifier = MODIFIERS[code];
    this.held.delete(code);
    if (!modifier || this.lone !== code) return undefined;
    this.lone = undefined;
    return modifier.usage;
  }

  reset(): void {
    this.held.clear();
    this.lone = undefined;
  }

  /** Masque QMK des modificateurs tenus ; AltGr (Ctrl gauche + Alt droit sous Windows) devient RALT seul. */
  private mods(): number {
    const altGr = this.held.has('AltRight');
    const list = [...this.held].flatMap((code) => {
      const modifier = MODIFIERS[code];
      return modifier && !(altGr && code === 'ControlLeft') ? [modifier] : [];
    });
    if (!list.length) return 0;
    // QMK n'a qu'un bit « droite » pour tous les modificateurs : droite seulement s'ils sont tous à droite
    const right = list.every((m) => m.right);
    return list.reduce((mask, m) => mask | m.bit, 0) | (right ? RIGHT : 0);
  }
}
