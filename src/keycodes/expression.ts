// Équivalent d'AnyKeycode (vial-gui any_keycode.py) : évalue une expression de keycode telle que
// « LSFT(KC_DOT) », « LT(2, KC_SPACE) », « MT(MOD_LCTL | MOD_LSFT, KC_A) » ou « 0x5224 ».
// Grammaire : expr := term (('|' | '^' | '&' | '+' | '-') term)* ; term := nombre | nom | nom '(' expr (',' expr)* ')'

type Resolve = (name: string) => number;
type KeycodeFunction = (args: number[]) => number;

export class KeycodeExpressionError extends Error {
  override readonly name = 'KeycodeExpressionError';
}

function modifierFunctions(r: Resolve): Record<string, KeycodeFunction> {
  const mods = (...names: string[]): KeycodeFunction => {
    const mask = names.reduce((acc, name) => acc | r(name), 0);
    return ([kc = 0]) => mask | kc;
  };
  const mt =
    (...names: string[]): KeycodeFunction =>
    ([kc = 0]) =>
      r('QK_MOD_TAP') | ((names.reduce((acc, name) => acc | r(name), 0) & 0x1f) << 8) | (kc & 0xff);
  const layer =
    (base: string): KeycodeFunction =>
    ([n = 0]) =>
      r(base) | (n & 0xff);

  const f: Record<string, KeycodeFunction> = {
    LCTL: mods('QK_LCTL'),
    LSFT: mods('QK_LSFT'),
    LALT: mods('QK_LALT'),
    LGUI: mods('QK_LGUI'),
    RCTL: mods('QK_RCTL'),
    RSFT: mods('QK_RSFT'),
    RALT: mods('QK_RALT'),
    RGUI: mods('QK_RGUI'),
    C_S: mods('QK_LCTL', 'QK_LSFT'),
    HYPR: mods('QK_LCTL', 'QK_LSFT', 'QK_LALT', 'QK_LGUI'),
    MEH: mods('QK_LCTL', 'QK_LSFT', 'QK_LALT'),
    LCAG: mods('QK_LCTL', 'QK_LALT', 'QK_LGUI'),
    SGUI: mods('QK_LGUI', 'QK_LSFT'),
    LCA: mods('QK_LCTL', 'QK_LALT'),
    LSA: mods('QK_LSFT', 'QK_LALT'),
    LAG: mods('QK_LALT', 'QK_LGUI'),
    RSA: mods('QK_RSFT', 'QK_RALT'),
    RCS: mods('QK_RCTL', 'QK_RSFT'),
    LCG: mods('QK_LCTL', 'QK_LGUI'),
    RCG: mods('QK_RCTL', 'QK_RGUI'),
    LT: ([n = 0, kc = 0]) => r('QK_LAYER_TAP') | ((n & 0xf) << 8) | (kc & 0xff),
    TO: ([n = 0]) => r('QK_TO') | (r('ON_PRESS') << 4) | (n & 0xff),
    MO: layer('QK_MOMENTARY'),
    DF: layer('QK_DEF_LAYER'),
    TG: layer('QK_TOGGLE_LAYER'),
    OSL: layer('QK_ONE_SHOT_LAYER'),
    TT: layer('QK_LAYER_TAP_TOGGLE'),
    LM: ([n = 0, mod = 0]) => r('QK_LAYER_MOD') | ((n & 0xf) << r('QMK_LM_SHIFT')) | (mod & r('QMK_LM_MASK')),
    OSM: ([mod = 0]) => r('QK_ONE_SHOT_MOD') | (mod & 0xff),
    MT: ([mod = 0, kc = 0]) => r('QK_MOD_TAP') | ((mod & 0x1f) << 8) | (kc & 0xff),
    TD: ([n = 0]) => r('QK_TAP_DANCE') | (n & 0xff),
    LCTL_T: mt('MOD_LCTL'),
    RCTL_T: mt('MOD_RCTL'),
    LSFT_T: mt('MOD_LSFT'),
    RSFT_T: mt('MOD_RSFT'),
    LALT_T: mt('MOD_LALT'),
    RALT_T: mt('MOD_RALT'),
    LGUI_T: mt('MOD_LGUI'),
    RGUI_T: mt('MOD_RGUI'),
    C_S_T: mt('MOD_LCTL', 'MOD_LSFT'),
    MEH_T: mt('MOD_LCTL', 'MOD_LSFT', 'MOD_LALT'),
    LCAG_T: mt('MOD_LCTL', 'MOD_LALT', 'MOD_LGUI'),
    RCAG_T: mt('MOD_RCTL', 'MOD_RALT', 'MOD_RGUI'),
    HYPR_T: mt('MOD_LCTL', 'MOD_LSFT', 'MOD_LALT', 'MOD_LGUI'),
    SGUI_T: mt('MOD_LGUI', 'MOD_LSFT'),
    LCA_T: mt('MOD_LCTL', 'MOD_LALT'),
    LSA_T: mt('MOD_LSFT', 'MOD_LALT'),
    LAG_T: mt('MOD_LALT', 'MOD_LGUI'),
    RSA_T: mt('MOD_RSFT', 'MOD_RALT'),
    RCS_T: mt('MOD_RCTL', 'MOD_RSFT'),
    LCG_T: mt('MOD_LCTL', 'MOD_LGUI'),
    RCG_T: mt('MOD_RCTL', 'MOD_RGUI'),
  };

  const aliases: Record<string, string> = {
    LOPT: 'LALT',
    LCMD: 'LGUI',
    LWIN: 'LGUI',
    ALGR: 'RALT',
    ROPT: 'RALT',
    RCMD: 'RGUI',
    RWIN: 'RGUI',
    SCMD: 'SGUI',
    SWIN: 'SGUI',
    LSG: 'SGUI',
    SAGR: 'RSA',
    C: 'LCTL',
    S: 'LSFT',
    A: 'LALT',
    G: 'LGUI',
    CTL_T: 'LCTL_T',
    SFT_T: 'LSFT_T',
    LOPT_T: 'LALT_T',
    ROPT_T: 'RALT_T',
    ALGR_T: 'RALT_T',
    ALT_T: 'LALT_T',
    OPT_T: 'LALT_T',
    LCMD_T: 'LGUI_T',
    LWIN_T: 'LGUI_T',
    RCMD_T: 'RGUI_T',
    RWIN_T: 'RGUI_T',
    GUI_T: 'LGUI_T',
    CMD_T: 'LGUI_T',
    WIN_T: 'LGUI_T',
    SCMD_T: 'SGUI_T',
    SWIN_T: 'SGUI_T',
    LSG_T: 'SGUI_T',
    SAGR_T: 'RSA_T',
    ALL_T: 'HYPR_T',
  };
  for (const [alias, target] of Object.entries(aliases)) {
    const fn = f[target];
    if (fn) f[alias] = fn;
  }
  for (let n = 0; n < 16; n++) {
    f[`LT${String(n)}`] = ([kc = 0]) => r('QK_LAYER_TAP') | ((n & 0xf) << 8) | (kc & 0xff);
  }
  return f;
}

const TOKEN = /\s*(0[xX][0-9a-fA-F]+|\d+|[A-Za-z_][A-Za-z0-9_]*|[(),|^&+-])/y;

export class KeycodeExpression {
  private readonly functions: Record<string, KeycodeFunction>;

  constructor(
    private readonly names: ReadonlyMap<string, number>,
    resolve: Resolve,
  ) {
    this.functions = modifierFunctions(resolve);
  }

  evaluate(source: string): number {
    const tokens: string[] = [];
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < source.length) {
      const start = TOKEN.lastIndex;
      const match = TOKEN.exec(source);
      if (!match?.[1]) {
        if (source.slice(start).trim() === '') break;
        throw new KeycodeExpressionError(`Caractère inattendu dans « ${source} »`);
      }
      tokens.push(match[1]);
    }
    let position = 0;
    const peek = (): string | undefined => tokens[position];
    const take = (expected?: string): string => {
      const token = tokens[position++];
      if (token === undefined || (expected !== undefined && token !== expected)) {
        throw new KeycodeExpressionError(`« ${expected ?? 'valeur'} » attendu dans « ${source} »`);
      }
      return token;
    };

    const term = (): number => {
      const token = take();
      if (/^\d|^0[xX]/.test(token)) return Number(token);
      if (peek() === '(') {
        take('(');
        const args: number[] = [];
        if (peek() !== ')') {
          args.push(expression());
          while (peek() === ',') {
            take(',');
            args.push(expression());
          }
        }
        take(')');
        const fn = this.functions[token];
        if (!fn) throw new KeycodeExpressionError(`Fonction inconnue « ${token} »`);
        return fn(args);
      }
      const value = this.names.get(token);
      if (value === undefined) throw new KeycodeExpressionError(`Nom inconnu « ${token} »`);
      return value;
    };

    const expression = (): number => {
      let value = term();
      for (let op = peek(); op && '|^&+-'.includes(op) && op.length === 1; op = peek()) {
        take();
        const right = term();
        if (op === '|') value |= right;
        else if (op === '^') value ^= right;
        else if (op === '&') value &= right;
        else if (op === '+') value += right;
        else value -= right;
      }
      return value;
    };

    const result = expression();
    if (position !== tokens.length) {
      throw new KeycodeExpressionError(`Fin inattendue dans « ${source} »`);
    }
    return result;
  }
}
