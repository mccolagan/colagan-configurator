// KeyboardEvent.code -> usage HID (= keycode QMK de base), pour retrouver la touche frappée sur le vrai clavier.

const NAMED: Record<string, number> = {
  Enter: 0x28,
  Escape: 0x29,
  Backspace: 0x2a,
  Tab: 0x2b,
  Space: 0x2c,
  Minus: 0x2d,
  Equal: 0x2e,
  BracketLeft: 0x2f,
  BracketRight: 0x30,
  Backslash: 0x31,
  Semicolon: 0x33,
  Quote: 0x34,
  Backquote: 0x35,
  Comma: 0x36,
  Period: 0x37,
  Slash: 0x38,
  CapsLock: 0x39,
  PrintScreen: 0x46,
  ScrollLock: 0x47,
  Pause: 0x48,
  Insert: 0x49,
  Home: 0x4a,
  PageUp: 0x4b,
  Delete: 0x4c,
  End: 0x4d,
  PageDown: 0x4e,
  ArrowRight: 0x4f,
  ArrowLeft: 0x50,
  ArrowDown: 0x51,
  ArrowUp: 0x52,
  NumLock: 0x53,
  NumpadDivide: 0x54,
  NumpadMultiply: 0x55,
  NumpadSubtract: 0x56,
  NumpadAdd: 0x57,
  NumpadEnter: 0x58,
  NumpadDecimal: 0x63,
  IntlBackslash: 0x64,
  ContextMenu: 0x65,
  AudioVolumeMute: 0xa8,
  AudioVolumeUp: 0xa9,
  AudioVolumeDown: 0xaa,
  MediaTrackNext: 0xab,
  MediaTrackPrevious: 0xac,
  MediaStop: 0xad,
  MediaPlayPause: 0xae,
  ControlLeft: 0xe0,
  ShiftLeft: 0xe1,
  AltLeft: 0xe2,
  MetaLeft: 0xe3,
  ControlRight: 0xe4,
  ShiftRight: 0xe5,
  AltRight: 0xe6,
  MetaRight: 0xe7,
};

/** Usages possibles d'un event.code : la touche ISO près d'Entrée arrive en « Backslash » (KC_NUHS). */
export function hidUsages(code: string): number[] {
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter) return [0x04 + letter.charCodeAt(0) - 65];
  const digit = /^Digit(\d)$/.exec(code)?.[1];
  if (digit) return [digit === '0' ? 0x27 : 0x1e + Number(digit) - 1];
  const pad = /^Numpad(\d)$/.exec(code)?.[1];
  if (pad) return [pad === '0' ? 0x62 : 0x59 + Number(pad) - 1];
  const fn = /^F(\d{1,2})$/.exec(code)?.[1];
  if (fn) {
    const n = Number(fn);
    if (n >= 1 && n <= 12) return [0x3a + n - 1];
    if (n >= 13 && n <= 24) return [0x68 + n - 13];
  }
  const named = NAMED[code];
  if (named === undefined) return [];
  return code === 'Backslash' ? [0x31, 0x32] : [named];
}

/** Le keycode envoie-t-il cet usage ? Exact, ou via LSFT(kc), mod-tap ou LT en appui court (octet bas). */
export function sendsUsage(keycode: number, usage: number): boolean {
  if (keycode === usage) return true;
  // 0x0100-0x1FFF : modificateurs + touche ; 0x2000-0x3FFF : mod-tap ; 0x4000-0x4FFF : LT(n, kc)
  return keycode >= 0x100 && keycode < 0x5000 && (keycode & 0xff) === usage;
}
