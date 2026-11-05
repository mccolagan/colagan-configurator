// FICHIER GÉNÉRÉ par scripts/gen-keycodes.mjs — ne pas modifier à la main.
// Sources : vial-gui (keycodes_v6.py, keycodes.py), vial-qmk (quantum/vialrgb_effects.inc).

export interface VialKeycodeDef {
  readonly id: string;
  readonly label: string;
  readonly tooltip?: string;
  readonly aliases?: readonly string[];
  readonly masked?: boolean;
  readonly feature?: string;
}

/** Nom Vial -> valeur (protocole 6), hors formes calculées (MO(n), M0, TD(n), USERnn, LTn(kc)…). */
export const VIAL_V6_VALUES: Readonly<Record<string, number>> = {
  "QK_LAYER_TAP": 16384,
  "MOD_LCTL": 1,
  "MOD_LSFT": 2,
  "MOD_LALT": 4,
  "MOD_LGUI": 8,
  "MOD_RCTL": 17,
  "MOD_RSFT": 18,
  "MOD_RALT": 20,
  "MOD_RGUI": 24,
  "MOD_HYPR": 15,
  "MOD_MEH": 7,
  "QK_TO": 20992,
  "QK_MOMENTARY": 21024,
  "QK_DEF_LAYER": 21056,
  "QK_PERSISTENT_DEF_LAYER": 21216,
  "QK_TOGGLE_LAYER": 21088,
  "QK_ONE_SHOT_LAYER": 21120,
  "QK_ONE_SHOT_MOD": 21152,
  "QK_TAP_DANCE": 22272,
  "QK_LAYER_TAP_TOGGLE": 21184,
  "QK_LAYER_MOD": 20480,
  "QK_MOD_TAP": 8192,
  "ON_PRESS": 1,
  "QK_LCTL": 256,
  "QK_LSFT": 512,
  "QK_LALT": 1024,
  "QK_LGUI": 2048,
  "QK_RCTL": 4352,
  "QK_RSFT": 4608,
  "QK_RALT": 5120,
  "QK_RGUI": 6144,
  "QK_MACRO": 30464,
  "ALL_T(kc)": 12032,
  "C_S_T(kc)": 8960,
  "C_S(kc)": 768,
  "HYPR(kc)": 3840,
  "LALT_T(kc)": 9216,
  "LALT(kc)": 1024,
  "LCA_T(kc)": 9472,
  "LCA(kc)": 1280,
  "LAG_T(kc)": 11264,
  "LAG(kc)": 3072,
  "LCAG_T(kc)": 11520,
  "LCAG(kc)": 3328,
  "LCG_T(kc)": 10496,
  "LCG(kc)": 2304,
  "LCTL_T(kc)": 8448,
  "LCTL(kc)": 256,
  "LGUI_T(kc)": 10240,
  "LGUI(kc)": 2048,
  "LSA_T(kc)": 9728,
  "LSA(kc)": 1536,
  "LSFT_T(kc)": 8704,
  "LSFT(kc)": 512,
  "MEH_T(kc)": 9984,
  "MEH(kc)": 1792,
  "RALT_T(kc)": 13312,
  "RALT(kc)": 5120,
  "RCAG_T(kc)": 15616,
  "RCG_T(kc)": 14592,
  "RCG(kc)": 6400,
  "RCTL_T(kc)": 12544,
  "RCTL(kc)": 4352,
  "RGUI_T(kc)": 14336,
  "RGUI(kc)": 6144,
  "RSFT_T(kc)": 12800,
  "RSFT(kc)": 4608,
  "SGUI_T(kc)": 10752,
  "SGUI(kc)": 2560,
  "OSM(MOD_LSFT)": 21154,
  "OSM(MOD_LCTL)": 21153,
  "OSM(MOD_LALT)": 21156,
  "OSM(MOD_LGUI)": 21160,
  "OSM(MOD_RSFT)": 21170,
  "OSM(MOD_RCTL)": 21169,
  "OSM(MOD_RALT)": 21172,
  "OSM(MOD_RGUI)": 21176,
  "OSM(MOD_LCTL|MOD_LSFT)": 21155,
  "OSM(MOD_LCTL|MOD_LALT)": 21157,
  "OSM(MOD_LCTL|MOD_LGUI)": 21161,
  "OSM(MOD_LSFT|MOD_LALT)": 21158,
  "OSM(MOD_LSFT|MOD_LGUI)": 21162,
  "OSM(MOD_LALT|MOD_LGUI)": 21164,
  "OSM(MOD_LCTL|MOD_LSFT|MOD_LGUI)": 21163,
  "OSM(MOD_LCTL|MOD_LALT|MOD_LGUI)": 21165,
  "OSM(MOD_LSFT|MOD_LALT|MOD_LGUI)": 21166,
  "OSM(MOD_MEH)": 21159,
  "OSM(MOD_HYPR)": 21167,
  "OSM(MOD_RCTL|MOD_RSFT)": 21171,
  "OSM(MOD_RCTL|MOD_RALT)": 21173,
  "OSM(MOD_RCTL|MOD_RGUI)": 21177,
  "OSM(MOD_RSFT|MOD_RALT)": 21174,
  "OSM(MOD_RSFT|MOD_RGUI)": 21178,
  "OSM(MOD_RALT|MOD_RGUI)": 21180,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RGUI)": 21179,
  "OSM(MOD_RCTL|MOD_RALT|MOD_RGUI)": 21181,
  "OSM(MOD_RSFT|MOD_RALT|MOD_RGUI)": 21182,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT)": 21175,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT|MOD_RGUI)": 21183,
  "KC_NO": 0,
  "KC_TRNS": 1,
  "KC_NUMLOCK": 83,
  "KC_KP_SLASH": 84,
  "KC_KP_ASTERISK": 85,
  "KC_KP_MINUS": 86,
  "KC_KP_PLUS": 87,
  "KC_KP_ENTER": 88,
  "KC_KP_1": 89,
  "KC_KP_2": 90,
  "KC_KP_3": 91,
  "KC_KP_4": 92,
  "KC_KP_5": 93,
  "KC_KP_6": 94,
  "KC_KP_7": 95,
  "KC_KP_8": 96,
  "KC_KP_9": 97,
  "KC_KP_0": 98,
  "KC_KP_DOT": 99,
  "KC_KP_EQUAL": 103,
  "KC_KP_COMMA": 133,
  "KC_PSCREEN": 70,
  "KC_SCROLLLOCK": 71,
  "KC_PAUSE": 72,
  "KC_INSERT": 73,
  "KC_HOME": 74,
  "KC_PGUP": 75,
  "KC_DELETE": 76,
  "KC_END": 77,
  "KC_PGDOWN": 78,
  "KC_RIGHT": 79,
  "KC_LEFT": 80,
  "KC_DOWN": 81,
  "KC_UP": 82,
  "KC_A": 4,
  "KC_B": 5,
  "KC_C": 6,
  "KC_D": 7,
  "KC_E": 8,
  "KC_F": 9,
  "KC_G": 10,
  "KC_H": 11,
  "KC_I": 12,
  "KC_J": 13,
  "KC_K": 14,
  "KC_L": 15,
  "KC_M": 16,
  "KC_N": 17,
  "KC_O": 18,
  "KC_P": 19,
  "KC_Q": 20,
  "KC_R": 21,
  "KC_S": 22,
  "KC_T": 23,
  "KC_U": 24,
  "KC_V": 25,
  "KC_W": 26,
  "KC_X": 27,
  "KC_Y": 28,
  "KC_Z": 29,
  "KC_1": 30,
  "KC_2": 31,
  "KC_3": 32,
  "KC_4": 33,
  "KC_5": 34,
  "KC_6": 35,
  "KC_7": 36,
  "KC_8": 37,
  "KC_9": 38,
  "KC_0": 39,
  "KC_ENTER": 40,
  "KC_ESCAPE": 41,
  "KC_BSPACE": 42,
  "KC_TAB": 43,
  "KC_SPACE": 44,
  "KC_MINUS": 45,
  "KC_EQUAL": 46,
  "KC_LBRACKET": 47,
  "KC_RBRACKET": 48,
  "KC_BSLASH": 49,
  "KC_SCOLON": 51,
  "KC_QUOTE": 52,
  "KC_GRAVE": 53,
  "KC_COMMA": 54,
  "KC_DOT": 55,
  "KC_SLASH": 56,
  "KC_CAPSLOCK": 57,
  "KC_F1": 58,
  "KC_F2": 59,
  "KC_F3": 60,
  "KC_F4": 61,
  "KC_F5": 62,
  "KC_F6": 63,
  "KC_F7": 64,
  "KC_F8": 65,
  "KC_F9": 66,
  "KC_F10": 67,
  "KC_F11": 68,
  "KC_F12": 69,
  "KC_APPLICATION": 101,
  "KC_LCTRL": 224,
  "KC_LSHIFT": 225,
  "KC_LALT": 226,
  "KC_LGUI": 227,
  "KC_RCTRL": 228,
  "KC_RSHIFT": 229,
  "KC_RALT": 230,
  "KC_RGUI": 231,
  "KC_TILD": 565,
  "KC_EXLM": 542,
  "KC_AT": 543,
  "KC_HASH": 544,
  "KC_DLR": 545,
  "KC_PERC": 546,
  "KC_CIRC": 547,
  "KC_AMPR": 548,
  "KC_ASTR": 549,
  "KC_LPRN": 550,
  "KC_RPRN": 551,
  "KC_UNDS": 557,
  "KC_PLUS": 558,
  "KC_LCBR": 559,
  "KC_RCBR": 560,
  "KC_LT": 566,
  "KC_GT": 567,
  "KC_COLN": 563,
  "KC_PIPE": 561,
  "KC_QUES": 568,
  "KC_DQUO": 564,
  "KC_NONUS_HASH": 50,
  "KC_NONUS_BSLASH": 100,
  "KC_RO": 135,
  "KC_KANA": 136,
  "KC_JYEN": 137,
  "KC_HENK": 138,
  "KC_MHEN": 139,
  "KC_LANG1": 144,
  "KC_LANG2": 145,
  "KC_GESC": 31766,
  "KC_LSPO": 31770,
  "KC_RSPC": 31771,
  "KC_LCPO": 31768,
  "KC_RCPC": 31769,
  "KC_LAPO": 31772,
  "KC_RAPC": 31773,
  "KC_SFTENT": 31774,
  "MAGIC_SWAP_CONTROL_CAPSLOCK": 28672,
  "MAGIC_UNSWAP_CONTROL_CAPSLOCK": 28673,
  "MAGIC_CAPSLOCK_TO_CONTROL": 28676,
  "MAGIC_UNCAPSLOCK_TO_CONTROL": 28675,
  "MAGIC_SWAP_LCTL_LGUI": 28695,
  "MAGIC_UNSWAP_LCTL_LGUI": 28696,
  "MAGIC_SWAP_RCTL_RGUI": 28697,
  "MAGIC_UNSWAP_RCTL_RGUI": 28698,
  "MAGIC_SWAP_CTL_GUI": 28699,
  "MAGIC_UNSWAP_CTL_GUI": 28700,
  "MAGIC_TOGGLE_CTL_GUI": 28701,
  "MAGIC_SWAP_LALT_LGUI": 28677,
  "MAGIC_UNSWAP_LALT_LGUI": 28678,
  "MAGIC_SWAP_RALT_RGUI": 28679,
  "MAGIC_UNSWAP_RALT_RGUI": 28680,
  "MAGIC_SWAP_ALT_GUI": 28692,
  "MAGIC_UNSWAP_ALT_GUI": 28693,
  "MAGIC_TOGGLE_ALT_GUI": 28694,
  "MAGIC_NO_GUI": 28682,
  "MAGIC_UNNO_GUI": 28681,
  "MAGIC_TOGGLE_GUI": 28683,
  "MAGIC_SWAP_GRAVE_ESC": 28684,
  "MAGIC_UNSWAP_GRAVE_ESC": 28685,
  "MAGIC_SWAP_BACKSLASH_BACKSPACE": 28686,
  "MAGIC_UNSWAP_BACKSLASH_BACKSPACE": 28687,
  "MAGIC_HOST_NKRO": 28689,
  "MAGIC_UNHOST_NKRO": 28690,
  "MAGIC_TOGGLE_NKRO": 28691,
  "MAGIC_EE_HANDS_LEFT": 28702,
  "MAGIC_EE_HANDS_RIGHT": 28703,
  "AU_ON": 29824,
  "AU_OFF": 29825,
  "AU_TOG": 29826,
  "CLICKY_TOGGLE": 29834,
  "CLICKY_UP": 29837,
  "CLICKY_DOWN": 29838,
  "CLICKY_RESET": 29839,
  "MU_ON": 29840,
  "MU_OFF": 29841,
  "MU_TOG": 29842,
  "MU_MOD": 29843,
  "HPT_ON": 31808,
  "HPT_OFF": 31809,
  "HPT_TOG": 31810,
  "HPT_RST": 31811,
  "HPT_FBK": 31812,
  "HPT_BUZ": 31813,
  "HPT_MODI": 31814,
  "HPT_MODD": 31815,
  "HPT_CONT": 31816,
  "HPT_CONI": 31817,
  "HPT_COND": 31818,
  "HPT_DWLI": 31819,
  "HPT_DWLD": 31820,
  "KC_ASDN": 31760,
  "KC_ASUP": 31761,
  "KC_ASRP": 31762,
  "KC_ASON": 31763,
  "KC_ASOFF": 31764,
  "KC_ASTG": 31765,
  "CMB_ON": 31824,
  "CMB_OFF": 31825,
  "CMB_TOG": 31826,
  "BL_TOGG": 30722,
  "BL_STEP": 30725,
  "BL_BRTG": 30726,
  "BL_ON": 30720,
  "BL_OFF": 30721,
  "BL_INC": 30724,
  "BL_DEC": 30723,
  "RGB_TOG": 30752,
  "RGB_MOD": 30753,
  "RGB_RMOD": 30754,
  "RGB_HUI": 30755,
  "RGB_HUD": 30756,
  "RGB_SAI": 30757,
  "RGB_SAD": 30758,
  "RGB_VAI": 30759,
  "RGB_VAD": 30760,
  "RGB_SPI": 30761,
  "RGB_SPD": 30762,
  "RGB_M_P": 30763,
  "RGB_M_B": 30764,
  "RGB_M_R": 30765,
  "RGB_M_SW": 30766,
  "RGB_M_SN": 30767,
  "RGB_M_K": 30768,
  "RGB_M_X": 30769,
  "RGB_M_G": 30770,
  "RGB_M_T": 30771,
  "KC_F13": 104,
  "KC_F14": 105,
  "KC_F15": 106,
  "KC_F16": 107,
  "KC_F17": 108,
  "KC_F18": 109,
  "KC_F19": 110,
  "KC_F20": 111,
  "KC_F21": 112,
  "KC_F22": 113,
  "KC_F23": 114,
  "KC_F24": 115,
  "KC_PWR": 165,
  "KC_SLEP": 166,
  "KC_WAKE": 167,
  "KC_EXEC": 116,
  "KC_HELP": 117,
  "KC_SLCT": 119,
  "KC_STOP": 120,
  "KC_AGIN": 121,
  "KC_UNDO": 122,
  "KC_CUT": 123,
  "KC_COPY": 124,
  "KC_PSTE": 125,
  "KC_FIND": 126,
  "KC_CALC": 178,
  "KC_MAIL": 177,
  "KC_MSEL": 175,
  "KC_MYCM": 179,
  "KC_WSCH": 180,
  "KC_WHOM": 181,
  "KC_WBAK": 182,
  "KC_WFWD": 183,
  "KC_WSTP": 184,
  "KC_WREF": 185,
  "KC_WFAV": 186,
  "KC_BRIU": 189,
  "KC_BRID": 190,
  "KC_MPRV": 172,
  "KC_MNXT": 171,
  "KC_MUTE": 168,
  "KC_VOLD": 170,
  "KC_VOLU": 169,
  "KC__VOLDOWN": 129,
  "KC__VOLUP": 128,
  "KC_MSTP": 173,
  "KC_MPLY": 174,
  "KC_MRWD": 188,
  "KC_MFFD": 187,
  "KC_EJCT": 176,
  "KC_MS_U": 205,
  "KC_MS_D": 206,
  "KC_MS_L": 207,
  "KC_MS_R": 208,
  "KC_BTN1": 209,
  "KC_BTN2": 210,
  "KC_BTN3": 211,
  "KC_BTN4": 212,
  "KC_BTN5": 213,
  "KC_WH_U": 217,
  "KC_WH_D": 218,
  "KC_WH_L": 219,
  "KC_WH_R": 220,
  "KC_ACL0": 221,
  "KC_ACL1": 222,
  "KC_ACL2": 223,
  "KC_LCAP": 130,
  "KC_LNUM": 131,
  "KC_LSCR": 132,
  "DYN_REC_START1": 31827,
  "DYN_REC_START2": 31828,
  "DYN_REC_STOP": 31829,
  "DYN_MACRO_PLAY1": 31830,
  "DYN_MACRO_PLAY2": 31831,
  "MI_C": 28931,
  "MI_Cs": 28932,
  "MI_D": 28933,
  "MI_Ds": 28934,
  "MI_E": 28935,
  "MI_F": 28936,
  "MI_Fs": 28937,
  "MI_G": 28938,
  "MI_Gs": 28939,
  "MI_A": 28940,
  "MI_As": 28941,
  "MI_B": 28942,
  "MI_C_1": 28943,
  "MI_Cs_1": 28944,
  "MI_D_1": 28945,
  "MI_Ds_1": 28946,
  "MI_E_1": 28947,
  "MI_F_1": 28948,
  "MI_Fs_1": 28949,
  "MI_G_1": 28950,
  "MI_Gs_1": 28951,
  "MI_A_1": 28952,
  "MI_As_1": 28953,
  "MI_B_1": 28954,
  "MI_C_2": 28955,
  "MI_Cs_2": 28956,
  "MI_D_2": 28957,
  "MI_Ds_2": 28958,
  "MI_E_2": 28959,
  "MI_F_2": 28960,
  "MI_Fs_2": 28961,
  "MI_G_2": 28962,
  "MI_Gs_2": 28963,
  "MI_A_2": 28964,
  "MI_As_2": 28965,
  "MI_B_2": 28966,
  "MI_C_3": 28967,
  "MI_Cs_3": 28968,
  "MI_D_3": 28969,
  "MI_Ds_3": 28970,
  "MI_E_3": 28971,
  "MI_F_3": 28972,
  "MI_Fs_3": 28973,
  "MI_G_3": 28974,
  "MI_Gs_3": 28975,
  "MI_A_3": 28976,
  "MI_As_3": 28977,
  "MI_B_3": 28978,
  "MI_C_4": 28979,
  "MI_Cs_4": 28980,
  "MI_D_4": 28981,
  "MI_Ds_4": 28982,
  "MI_E_4": 28983,
  "MI_F_4": 28984,
  "MI_Fs_4": 28985,
  "MI_G_4": 28986,
  "MI_Gs_4": 28987,
  "MI_A_4": 28988,
  "MI_As_4": 28989,
  "MI_B_4": 28990,
  "MI_C_5": 28991,
  "MI_Cs_5": 28992,
  "MI_D_5": 28993,
  "MI_Ds_5": 28994,
  "MI_E_5": 28995,
  "MI_F_5": 28996,
  "MI_Fs_5": 28997,
  "MI_G_5": 28998,
  "MI_Gs_5": 28999,
  "MI_A_5": 29000,
  "MI_As_5": 29001,
  "MI_B_5": 29002,
  "MI_ALLOFF": 29061,
  "MI_OCT_N2": 29003,
  "MI_OCT_N1": 29004,
  "MI_OCT_0": 29005,
  "MI_OCT_1": 29006,
  "MI_OCT_2": 29007,
  "MI_OCT_3": 29008,
  "MI_OCT_4": 29009,
  "MI_OCT_5": 29010,
  "MI_OCT_6": 29011,
  "MI_OCT_7": 29012,
  "MI_OCTD": 29013,
  "MI_OCTU": 29014,
  "MI_TRNS_N6": 29015,
  "MI_TRNS_N5": 29016,
  "MI_TRNS_N4": 29017,
  "MI_TRNS_N3": 29018,
  "MI_TRNS_N2": 29019,
  "MI_TRNS_N1": 29020,
  "MI_TRNS_0": 29021,
  "MI_TRNS_1": 29022,
  "MI_TRNS_2": 29023,
  "MI_TRNS_3": 29024,
  "MI_TRNS_4": 29025,
  "MI_TRNS_5": 29026,
  "MI_TRNS_6": 29027,
  "MI_TRNSD": 29028,
  "MI_TRNSU": 29029,
  "MI_VEL_1": 29031,
  "MI_VEL_2": 29032,
  "MI_VEL_3": 29033,
  "MI_VEL_4": 29034,
  "MI_VEL_5": 29035,
  "MI_VEL_6": 29036,
  "MI_VEL_7": 29037,
  "MI_VEL_8": 29038,
  "MI_VEL_9": 29039,
  "MI_VEL_10": 29040,
  "MI_VELD": 29041,
  "MI_VELU": 29042,
  "MI_CH1": 29043,
  "MI_CH2": 29044,
  "MI_CH3": 29045,
  "MI_CH4": 29046,
  "MI_CH5": 29047,
  "MI_CH6": 29048,
  "MI_CH7": 29049,
  "MI_CH8": 29050,
  "MI_CH9": 29051,
  "MI_CH10": 29052,
  "MI_CH11": 29053,
  "MI_CH12": 29054,
  "MI_CH13": 29055,
  "MI_CH14": 29056,
  "MI_CH15": 29057,
  "MI_CH16": 29058,
  "MI_CHD": 29059,
  "MI_CHU": 29060,
  "MI_SUS": 29062,
  "MI_PORT": 29063,
  "MI_SOST": 29064,
  "MI_SOFT": 29065,
  "MI_LEG": 29066,
  "MI_MOD": 29067,
  "MI_MODSD": 29068,
  "MI_MODSU": 29069,
  "MI_BENDD": 29070,
  "MI_BENDU": 29071,
  "QK_BOOT": 31744,
  "QK_REBOOT": 31745,
  "QK_CLEAR_EEPROM": 31747,
  "QK_CAPS_WORD_TOGGLE": 31859,
  "FN_MO13": 31863,
  "FN_MO23": 31864,
  "QK_REPEAT_KEY": 31865,
  "QK_ALT_REPEAT_KEY": 31866,
  "QK_LAYER_LOCK": 31867,
  "QK_KB": 32256,
  "QMK_LM_SHIFT": 5,
  "QMK_LM_MASK": 31,
  "RM_ON": 30784,
  "RM_OFF": 30785,
  "RM_TOGG": 30786,
  "RM_NEXT": 30787,
  "RM_PREV": 30788,
  "RM_HUEU": 30789,
  "RM_HUED": 30790,
  "RM_SATU": 30791,
  "RM_SATD": 30792,
  "RM_VALU": 30793,
  "RM_VALD": 30794,
  "RM_SPDU": 30795,
  "RM_SPDD": 30796
};

/** Listes de keycodes de l'interface Vial, dans l'ordre de recreate_keycodes(). */
export const VIAL_GROUPS = {
  "special": [
    {
      "id": "KC_NO",
      "label": ""
    },
    {
      "id": "KC_TRNS",
      "label": "▽",
      "aliases": [
        "KC_TRANSPARENT"
      ]
    }
  ],
  "basic": [
    {
      "id": "KC_A",
      "label": "A"
    },
    {
      "id": "KC_B",
      "label": "B"
    },
    {
      "id": "KC_C",
      "label": "C"
    },
    {
      "id": "KC_D",
      "label": "D"
    },
    {
      "id": "KC_E",
      "label": "E"
    },
    {
      "id": "KC_F",
      "label": "F"
    },
    {
      "id": "KC_G",
      "label": "G"
    },
    {
      "id": "KC_H",
      "label": "H"
    },
    {
      "id": "KC_I",
      "label": "I"
    },
    {
      "id": "KC_J",
      "label": "J"
    },
    {
      "id": "KC_K",
      "label": "K"
    },
    {
      "id": "KC_L",
      "label": "L"
    },
    {
      "id": "KC_M",
      "label": "M"
    },
    {
      "id": "KC_N",
      "label": "N"
    },
    {
      "id": "KC_O",
      "label": "O"
    },
    {
      "id": "KC_P",
      "label": "P"
    },
    {
      "id": "KC_Q",
      "label": "Q"
    },
    {
      "id": "KC_R",
      "label": "R"
    },
    {
      "id": "KC_S",
      "label": "S"
    },
    {
      "id": "KC_T",
      "label": "T"
    },
    {
      "id": "KC_U",
      "label": "U"
    },
    {
      "id": "KC_V",
      "label": "V"
    },
    {
      "id": "KC_W",
      "label": "W"
    },
    {
      "id": "KC_X",
      "label": "X"
    },
    {
      "id": "KC_Y",
      "label": "Y"
    },
    {
      "id": "KC_Z",
      "label": "Z"
    },
    {
      "id": "KC_1",
      "label": "!\n1"
    },
    {
      "id": "KC_2",
      "label": "@\n2"
    },
    {
      "id": "KC_3",
      "label": "#\n3"
    },
    {
      "id": "KC_4",
      "label": "$\n4"
    },
    {
      "id": "KC_5",
      "label": "%\n5"
    },
    {
      "id": "KC_6",
      "label": "^\n6"
    },
    {
      "id": "KC_7",
      "label": "&\n7"
    },
    {
      "id": "KC_8",
      "label": "*\n8"
    },
    {
      "id": "KC_9",
      "label": "(\n9"
    },
    {
      "id": "KC_0",
      "label": ")\n0"
    },
    {
      "id": "KC_ENTER",
      "label": "Enter",
      "aliases": [
        "KC_ENT"
      ]
    },
    {
      "id": "KC_ESCAPE",
      "label": "Esc",
      "aliases": [
        "KC_ESC"
      ]
    },
    {
      "id": "KC_BSPACE",
      "label": "Bksp",
      "aliases": [
        "KC_BSPC"
      ]
    },
    {
      "id": "KC_TAB",
      "label": "Tab"
    },
    {
      "id": "KC_SPACE",
      "label": "Space",
      "aliases": [
        "KC_SPC"
      ]
    },
    {
      "id": "KC_MINUS",
      "label": "_\n-",
      "aliases": [
        "KC_MINS"
      ]
    },
    {
      "id": "KC_EQUAL",
      "label": "+\n=",
      "aliases": [
        "KC_EQL"
      ]
    },
    {
      "id": "KC_LBRACKET",
      "label": "{\n[",
      "aliases": [
        "KC_LBRC"
      ]
    },
    {
      "id": "KC_RBRACKET",
      "label": "}\n]",
      "aliases": [
        "KC_RBRC"
      ]
    },
    {
      "id": "KC_BSLASH",
      "label": "|\n\\",
      "aliases": [
        "KC_BSLS"
      ]
    },
    {
      "id": "KC_SCOLON",
      "label": ":\n;",
      "aliases": [
        "KC_SCLN"
      ]
    },
    {
      "id": "KC_QUOTE",
      "label": "\"\n'",
      "aliases": [
        "KC_QUOT"
      ]
    },
    {
      "id": "KC_GRAVE",
      "label": "~\n`",
      "aliases": [
        "KC_GRV",
        "KC_ZKHK"
      ]
    },
    {
      "id": "KC_COMMA",
      "label": "<\n,",
      "aliases": [
        "KC_COMM"
      ]
    },
    {
      "id": "KC_DOT",
      "label": ">\n."
    },
    {
      "id": "KC_SLASH",
      "label": "?\n/",
      "aliases": [
        "KC_SLSH"
      ]
    },
    {
      "id": "KC_CAPSLOCK",
      "label": "Caps\nLock",
      "aliases": [
        "KC_CLCK",
        "KC_CAPS"
      ]
    },
    {
      "id": "KC_F1",
      "label": "F1"
    },
    {
      "id": "KC_F2",
      "label": "F2"
    },
    {
      "id": "KC_F3",
      "label": "F3"
    },
    {
      "id": "KC_F4",
      "label": "F4"
    },
    {
      "id": "KC_F5",
      "label": "F5"
    },
    {
      "id": "KC_F6",
      "label": "F6"
    },
    {
      "id": "KC_F7",
      "label": "F7"
    },
    {
      "id": "KC_F8",
      "label": "F8"
    },
    {
      "id": "KC_F9",
      "label": "F9"
    },
    {
      "id": "KC_F10",
      "label": "F10"
    },
    {
      "id": "KC_F11",
      "label": "F11"
    },
    {
      "id": "KC_F12",
      "label": "F12"
    },
    {
      "id": "KC_APPLICATION",
      "label": "Menu",
      "aliases": [
        "KC_APP"
      ]
    },
    {
      "id": "KC_LCTRL",
      "label": "LCtrl",
      "aliases": [
        "KC_LCTL"
      ]
    },
    {
      "id": "KC_LSHIFT",
      "label": "LShift",
      "aliases": [
        "KC_LSFT"
      ]
    },
    {
      "id": "KC_LALT",
      "label": "LAlt",
      "aliases": [
        "KC_LOPT"
      ]
    },
    {
      "id": "KC_LGUI",
      "label": "LGui",
      "aliases": [
        "KC_LCMD",
        "KC_LWIN"
      ]
    },
    {
      "id": "KC_RCTRL",
      "label": "RCtrl",
      "aliases": [
        "KC_RCTL"
      ]
    },
    {
      "id": "KC_RSHIFT",
      "label": "RShift",
      "aliases": [
        "KC_RSFT"
      ]
    },
    {
      "id": "KC_RALT",
      "label": "RAlt",
      "aliases": [
        "KC_ALGR",
        "KC_ROPT"
      ]
    },
    {
      "id": "KC_RGUI",
      "label": "RGui",
      "aliases": [
        "KC_RCMD",
        "KC_RWIN"
      ]
    },
    {
      "id": "KC_NUMLOCK",
      "label": "Num\nLock",
      "aliases": [
        "KC_NLCK"
      ]
    },
    {
      "id": "KC_KP_SLASH",
      "label": "/",
      "aliases": [
        "KC_PSLS"
      ]
    },
    {
      "id": "KC_KP_ASTERISK",
      "label": "*",
      "aliases": [
        "KC_PAST"
      ]
    },
    {
      "id": "KC_KP_MINUS",
      "label": "-",
      "aliases": [
        "KC_PMNS"
      ]
    },
    {
      "id": "KC_KP_PLUS",
      "label": "+",
      "aliases": [
        "KC_PPLS"
      ]
    },
    {
      "id": "KC_KP_ENTER",
      "label": "Num\nEnter",
      "aliases": [
        "KC_PENT"
      ]
    },
    {
      "id": "KC_KP_1",
      "label": "1",
      "aliases": [
        "KC_P1"
      ]
    },
    {
      "id": "KC_KP_2",
      "label": "2",
      "aliases": [
        "KC_P2"
      ]
    },
    {
      "id": "KC_KP_3",
      "label": "3",
      "aliases": [
        "KC_P3"
      ]
    },
    {
      "id": "KC_KP_4",
      "label": "4",
      "aliases": [
        "KC_P4"
      ]
    },
    {
      "id": "KC_KP_5",
      "label": "5",
      "aliases": [
        "KC_P5"
      ]
    },
    {
      "id": "KC_KP_6",
      "label": "6",
      "aliases": [
        "KC_P6"
      ]
    },
    {
      "id": "KC_KP_7",
      "label": "7",
      "aliases": [
        "KC_P7"
      ]
    },
    {
      "id": "KC_KP_8",
      "label": "8",
      "aliases": [
        "KC_P8"
      ]
    },
    {
      "id": "KC_KP_9",
      "label": "9",
      "aliases": [
        "KC_P9"
      ]
    },
    {
      "id": "KC_KP_0",
      "label": "0",
      "aliases": [
        "KC_P0"
      ]
    },
    {
      "id": "KC_KP_DOT",
      "label": ".",
      "aliases": [
        "KC_PDOT"
      ]
    },
    {
      "id": "KC_KP_EQUAL",
      "label": "=",
      "aliases": [
        "KC_PEQL"
      ]
    },
    {
      "id": "KC_KP_COMMA",
      "label": ",",
      "aliases": [
        "KC_PCMM"
      ]
    },
    {
      "id": "KC_PSCREEN",
      "label": "Print\nScreen",
      "aliases": [
        "KC_PSCR"
      ]
    },
    {
      "id": "KC_SCROLLLOCK",
      "label": "Scroll\nLock",
      "aliases": [
        "KC_SLCK",
        "KC_BRMD"
      ]
    },
    {
      "id": "KC_PAUSE",
      "label": "Pause",
      "aliases": [
        "KC_PAUS",
        "KC_BRK",
        "KC_BRMU"
      ]
    },
    {
      "id": "KC_INSERT",
      "label": "Insert",
      "aliases": [
        "KC_INS"
      ]
    },
    {
      "id": "KC_HOME",
      "label": "Home"
    },
    {
      "id": "KC_PGUP",
      "label": "Page\nUp"
    },
    {
      "id": "KC_DELETE",
      "label": "Del",
      "aliases": [
        "KC_DEL"
      ]
    },
    {
      "id": "KC_END",
      "label": "End"
    },
    {
      "id": "KC_PGDOWN",
      "label": "Page\nDown",
      "aliases": [
        "KC_PGDN"
      ]
    },
    {
      "id": "KC_RIGHT",
      "label": "Right",
      "aliases": [
        "KC_RGHT"
      ]
    },
    {
      "id": "KC_LEFT",
      "label": "Left"
    },
    {
      "id": "KC_DOWN",
      "label": "Down"
    },
    {
      "id": "KC_UP",
      "label": "Up"
    }
  ],
  "shifted": [
    {
      "id": "KC_TILD",
      "label": "~"
    },
    {
      "id": "KC_EXLM",
      "label": "!"
    },
    {
      "id": "KC_AT",
      "label": "@"
    },
    {
      "id": "KC_HASH",
      "label": "#"
    },
    {
      "id": "KC_DLR",
      "label": "$"
    },
    {
      "id": "KC_PERC",
      "label": "%"
    },
    {
      "id": "KC_CIRC",
      "label": "^"
    },
    {
      "id": "KC_AMPR",
      "label": "&"
    },
    {
      "id": "KC_ASTR",
      "label": "*"
    },
    {
      "id": "KC_LPRN",
      "label": "("
    },
    {
      "id": "KC_RPRN",
      "label": ")"
    },
    {
      "id": "KC_UNDS",
      "label": "_"
    },
    {
      "id": "KC_PLUS",
      "label": "+"
    },
    {
      "id": "KC_LCBR",
      "label": "{"
    },
    {
      "id": "KC_RCBR",
      "label": "}"
    },
    {
      "id": "KC_LT",
      "label": "<"
    },
    {
      "id": "KC_GT",
      "label": ">"
    },
    {
      "id": "KC_COLN",
      "label": ":"
    },
    {
      "id": "KC_PIPE",
      "label": "|"
    },
    {
      "id": "KC_QUES",
      "label": "?"
    },
    {
      "id": "KC_DQUO",
      "label": "\""
    }
  ],
  "iso": [
    {
      "id": "KC_NONUS_HASH",
      "label": "~\n#",
      "tooltip": "Non-US # and ~",
      "aliases": [
        "KC_NUHS"
      ]
    },
    {
      "id": "KC_NONUS_BSLASH",
      "label": "|\n\\",
      "tooltip": "Non-US \\ and |",
      "aliases": [
        "KC_NUBS"
      ]
    },
    {
      "id": "KC_RO",
      "label": "_\n\\",
      "tooltip": "JIS \\ and _",
      "aliases": [
        "KC_INT1"
      ]
    },
    {
      "id": "KC_KANA",
      "label": "カタカナ\nひらがな",
      "tooltip": "JIS Katakana/Hiragana",
      "aliases": [
        "KC_INT2"
      ]
    },
    {
      "id": "KC_JYEN",
      "label": "|\n¥",
      "aliases": [
        "KC_INT3"
      ]
    },
    {
      "id": "KC_HENK",
      "label": "変換",
      "tooltip": "JIS Henkan",
      "aliases": [
        "KC_INT4"
      ]
    },
    {
      "id": "KC_MHEN",
      "label": "無変換",
      "tooltip": "JIS Muhenkan",
      "aliases": [
        "KC_INT5"
      ]
    }
  ],
  "boot": [
    {
      "id": "QK_BOOT",
      "label": "Boot-\nloader",
      "tooltip": "Put the keyboard into bootloader mode for flashing",
      "aliases": [
        "RESET"
      ]
    },
    {
      "id": "QK_REBOOT",
      "label": "Reboot",
      "tooltip": "Reboots the keyboard. Does not load the bootloader"
    },
    {
      "id": "QK_CLEAR_EEPROM",
      "label": "Clear\nEEPROM",
      "tooltip": "Reinitializes the keyboard's EEPROM (persistent memory)",
      "aliases": [
        "EE_CLR"
      ]
    }
  ],
  "modifiers": [
    {
      "id": "OSM(MOD_LSFT)",
      "label": "OSM\nLSft",
      "tooltip": "Enable Left Shift for one keypress"
    },
    {
      "id": "OSM(MOD_LCTL)",
      "label": "OSM\nLCtl",
      "tooltip": "Enable Left Control for one keypress"
    },
    {
      "id": "OSM(MOD_LALT)",
      "label": "OSM\nLAlt",
      "tooltip": "Enable Left Alt for one keypress"
    },
    {
      "id": "OSM(MOD_LGUI)",
      "label": "OSM\nLGUI",
      "tooltip": "Enable Left GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RSFT)",
      "label": "OSM\nRSft",
      "tooltip": "Enable Right Shift for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL)",
      "label": "OSM\nRCtl",
      "tooltip": "Enable Right Control for one keypress"
    },
    {
      "id": "OSM(MOD_RALT)",
      "label": "OSM\nRAlt",
      "tooltip": "Enable Right Alt for one keypress"
    },
    {
      "id": "OSM(MOD_RGUI)",
      "label": "OSM\nRGUI",
      "tooltip": "Enable Right GUI for one keypress"
    },
    {
      "id": "OSM(MOD_LCTL|MOD_LSFT)",
      "label": "OSM\nCS",
      "tooltip": "Enable Left Control and Shift for one keypress"
    },
    {
      "id": "OSM(MOD_LCTL|MOD_LALT)",
      "label": "OSM\nCA",
      "tooltip": "Enable Left Control and Alt for one keypress"
    },
    {
      "id": "OSM(MOD_LCTL|MOD_LGUI)",
      "label": "OSM\nCG",
      "tooltip": "Enable Left Control and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_LSFT|MOD_LALT)",
      "label": "OSM\nSA",
      "tooltip": "Enable Left Shift and Alt for one keypress"
    },
    {
      "id": "OSM(MOD_LSFT|MOD_LGUI)",
      "label": "OSM\nSG",
      "tooltip": "Enable Left Shift and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_LALT|MOD_LGUI)",
      "label": "OSM\nAG",
      "tooltip": "Enable Left Alt and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RSFT)",
      "label": "OSM\nRCS",
      "tooltip": "Enable Right Control and Shift for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RALT)",
      "label": "OSM\nRCA",
      "tooltip": "Enable Right Control and Alt for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RGUI)",
      "label": "OSM\nRCG",
      "tooltip": "Enable Right Control and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RSFT|MOD_RALT)",
      "label": "OSM\nRSA",
      "tooltip": "Enable Right Shift and Alt for one keypress"
    },
    {
      "id": "OSM(MOD_RSFT|MOD_RGUI)",
      "label": "OSM\nRSG",
      "tooltip": "Enable Right Shift and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RALT|MOD_RGUI)",
      "label": "OSM\nRAG",
      "tooltip": "Enable Right Alt and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_LCTL|MOD_LSFT|MOD_LGUI)",
      "label": "OSM\nCSG",
      "tooltip": "Enable Left Control, Shift, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_LCTL|MOD_LALT|MOD_LGUI)",
      "label": "OSM\nCAG",
      "tooltip": "Enable Left Control, Alt, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_LSFT|MOD_LALT|MOD_LGUI)",
      "label": "OSM\nSAG",
      "tooltip": "Enable Left Shift, Alt, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RSFT|MOD_RGUI)",
      "label": "OSM\nRCSG",
      "tooltip": "Enable Right Control, Shift, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RALT|MOD_RGUI)",
      "label": "OSM\nRCAG",
      "tooltip": "Enable Right Control, Alt, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RSFT|MOD_RALT|MOD_RGUI)",
      "label": "OSM\nRSAG",
      "tooltip": "Enable Right Shift, Alt, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_MEH)",
      "label": "OSM\nMeh",
      "tooltip": "Enable Left Control, Shift, and Alt for one keypress"
    },
    {
      "id": "OSM(MOD_HYPR)",
      "label": "OSM\nHyper",
      "tooltip": "Enable Left Control, Shift, Alt, and GUI for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT)",
      "label": "OSM\nRMeh",
      "tooltip": "Enable Right Control, Shift, and Alt for one keypress"
    },
    {
      "id": "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT|MOD_RGUI)",
      "label": "OSM\nRHyp",
      "tooltip": "Enable Right Control, Shift, Alt, and GUI for one keypress"
    },
    {
      "id": "LSFT(kc)",
      "label": "LSft\n(kc)",
      "masked": true
    },
    {
      "id": "LCTL(kc)",
      "label": "LCtl\n(kc)",
      "masked": true
    },
    {
      "id": "LALT(kc)",
      "label": "LAlt\n(kc)",
      "masked": true
    },
    {
      "id": "LGUI(kc)",
      "label": "LGui\n(kc)",
      "masked": true
    },
    {
      "id": "RSFT(kc)",
      "label": "RSft\n(kc)",
      "masked": true
    },
    {
      "id": "RCTL(kc)",
      "label": "RCtl\n(kc)",
      "masked": true
    },
    {
      "id": "RALT(kc)",
      "label": "RAlt\n(kc)",
      "masked": true
    },
    {
      "id": "RGUI(kc)",
      "label": "RGui\n(kc)",
      "masked": true
    },
    {
      "id": "C_S(kc)",
      "label": "LCS\n(kc)",
      "tooltip": "LCTL + LSFT",
      "aliases": [
        "LCS(kc)"
      ],
      "masked": true
    },
    {
      "id": "LCA(kc)",
      "label": "LCA\n(kc)",
      "tooltip": "LCTL + LALT",
      "masked": true
    },
    {
      "id": "LCG(kc)",
      "label": "LCG\n(kc)",
      "tooltip": "LCTL + LGUI",
      "masked": true
    },
    {
      "id": "LSA(kc)",
      "label": "LSA\n(kc)",
      "tooltip": "LSFT + LALT",
      "masked": true
    },
    {
      "id": "LAG(kc)",
      "label": "LAG\n(kc)",
      "tooltip": "LALT + LGUI",
      "masked": true
    },
    {
      "id": "SGUI(kc)",
      "label": "LSG\n(kc)",
      "tooltip": "LGUI + LSFT",
      "aliases": [
        "LSG(kc)"
      ],
      "masked": true
    },
    {
      "id": "LCAG(kc)",
      "label": "LCAG\n(kc)",
      "tooltip": "LCTL + LALT + LGUI",
      "masked": true
    },
    {
      "id": "RCG(kc)",
      "label": "RCG\n(kc)",
      "tooltip": "RCTL + RGUI",
      "masked": true
    },
    {
      "id": "MEH(kc)",
      "label": "Meh\n(kc)",
      "tooltip": "LCTL + LSFT + LALT",
      "masked": true
    },
    {
      "id": "HYPR(kc)",
      "label": "Hyper\n(kc)",
      "tooltip": "LCTL + LSFT + LALT + LGUI",
      "masked": true
    },
    {
      "id": "LSFT_T(kc)",
      "label": "LSft_T\n(kc)",
      "tooltip": "Left Shift when held, kc when tapped",
      "masked": true
    },
    {
      "id": "LCTL_T(kc)",
      "label": "LCtl_T\n(kc)",
      "tooltip": "Left Control when held, kc when tapped",
      "masked": true
    },
    {
      "id": "LALT_T(kc)",
      "label": "LAlt_T\n(kc)",
      "tooltip": "Left Alt when held, kc when tapped",
      "masked": true
    },
    {
      "id": "LGUI_T(kc)",
      "label": "LGui_T\n(kc)",
      "tooltip": "Left GUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "RSFT_T(kc)",
      "label": "RSft_T\n(kc)",
      "tooltip": "Right Shift when held, kc when tapped",
      "masked": true
    },
    {
      "id": "RCTL_T(kc)",
      "label": "RCtl_T\n(kc)",
      "tooltip": "Right Control when held, kc when tapped",
      "masked": true
    },
    {
      "id": "RALT_T(kc)",
      "label": "RAlt_T\n(kc)",
      "tooltip": "Right Alt when held, kc when tapped",
      "masked": true
    },
    {
      "id": "RGUI_T(kc)",
      "label": "RGui_T\n(kc)",
      "tooltip": "Right GUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "C_S_T(kc)",
      "label": "LCS_T\n(kc)",
      "tooltip": "Left Control + Left Shift when held, kc when tapped",
      "aliases": [
        "LCS_T(kc)"
      ],
      "masked": true
    },
    {
      "id": "LCA_T(kc)",
      "label": "LCA_T\n(kc)",
      "tooltip": "LCTL + LALT when held, kc when tapped",
      "masked": true
    },
    {
      "id": "LCG_T(kc)",
      "label": "LCG_T\n(kc)",
      "tooltip": "LCTL + LGUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "LSA_T(kc)",
      "label": "LSA_T\n(kc)",
      "tooltip": "LSFT + LALT when held, kc when tapped",
      "masked": true
    },
    {
      "id": "LAG_T(kc)",
      "label": "LAG_T\n(kc)",
      "tooltip": "LALT + LGUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "SGUI_T(kc)",
      "label": "LSG_T\n(kc)",
      "tooltip": "LGUI + LSFT when held, kc when tapped",
      "aliases": [
        "LSG_T(kc)"
      ],
      "masked": true
    },
    {
      "id": "LCAG_T(kc)",
      "label": "LCAG_T\n(kc)",
      "tooltip": "LCTL + LALT + LGUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "RCG_T(kc)",
      "label": "RCG_T\n(kc)",
      "tooltip": "RCTL + RGUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "RCAG_T(kc)",
      "label": "RCAG_T\n(kc)",
      "tooltip": "RCTL + RALT + RGUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "MEH_T(kc)",
      "label": "Meh_T\n(kc)",
      "tooltip": "LCTL + LSFT + LALT when held, kc when tapped",
      "masked": true
    },
    {
      "id": "ALL_T(kc)",
      "label": "ALL_T\n(kc)",
      "tooltip": "LCTL + LSFT + LALT + LGUI when held, kc when tapped",
      "masked": true
    },
    {
      "id": "KC_GESC",
      "label": "~\nEsc",
      "tooltip": "Esc normally, but ~ when Shift or GUI is pressed"
    },
    {
      "id": "KC_LSPO",
      "label": "LS\n(",
      "tooltip": "Left Shift when held, ( when tapped"
    },
    {
      "id": "KC_RSPC",
      "label": "RS\n)",
      "tooltip": "Right Shift when held, ) when tapped"
    },
    {
      "id": "KC_LCPO",
      "label": "LC\n(",
      "tooltip": "Left Control when held, ( when tapped"
    },
    {
      "id": "KC_RCPC",
      "label": "RC\n)",
      "tooltip": "Right Control when held, ) when tapped"
    },
    {
      "id": "KC_LAPO",
      "label": "LA\n(",
      "tooltip": "Left Alt when held, ( when tapped"
    },
    {
      "id": "KC_RAPC",
      "label": "RA\n)",
      "tooltip": "Right Alt when held, ) when tapped"
    },
    {
      "id": "KC_SFTENT",
      "label": "RS\nEnter",
      "tooltip": "Right Shift when held, Enter when tapped"
    }
  ],
  "quantum": [
    {
      "id": "MAGIC_SWAP_CONTROL_CAPSLOCK",
      "label": "Swap\nCtrl\nCaps",
      "tooltip": "Swap Caps Lock and Left Control",
      "aliases": [
        "CL_SWAP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_CONTROL_CAPSLOCK",
      "label": "Unswap\nCtrl\nCaps",
      "tooltip": "Unswap Caps Lock and Left Control",
      "aliases": [
        "CL_NORM"
      ]
    },
    {
      "id": "MAGIC_CAPSLOCK_TO_CONTROL",
      "label": "Caps\nto\nCtrl",
      "tooltip": "Treat Caps Lock as Control",
      "aliases": [
        "CL_CTRL"
      ]
    },
    {
      "id": "MAGIC_UNCAPSLOCK_TO_CONTROL",
      "label": "Caps\nnot to\nCtrl",
      "tooltip": "Stop treating Caps Lock as Control",
      "aliases": [
        "CL_CAPS"
      ]
    },
    {
      "id": "MAGIC_SWAP_LCTL_LGUI",
      "label": "Swap\nLCtl\nLGui",
      "tooltip": "Swap Left Control and GUI",
      "aliases": [
        "LCG_SWP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_LCTL_LGUI",
      "label": "Unswap\nLCtl\nLGui",
      "tooltip": "Unswap Left Control and GUI",
      "aliases": [
        "LCG_NRM"
      ]
    },
    {
      "id": "MAGIC_SWAP_RCTL_RGUI",
      "label": "Swap\nRCtl\nRGui",
      "tooltip": "Swap Right Control and GUI",
      "aliases": [
        "RCG_SWP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_RCTL_RGUI",
      "label": "Unswap\nRCtl\nRGui",
      "tooltip": "Unswap Right Control and GUI",
      "aliases": [
        "RCG_NRM"
      ]
    },
    {
      "id": "MAGIC_SWAP_CTL_GUI",
      "label": "Swap\nCtl\nGui",
      "tooltip": "Swap Control and GUI on both sides",
      "aliases": [
        "CG_SWAP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_CTL_GUI",
      "label": "Unswap\nCtl\nGui",
      "tooltip": "Unswap Control and GUI on both sides",
      "aliases": [
        "CG_NORM"
      ]
    },
    {
      "id": "MAGIC_TOGGLE_CTL_GUI",
      "label": "Toggle\nCtl\nGui",
      "tooltip": "Toggle Control and GUI swap on both sides",
      "aliases": [
        "CG_TOGG"
      ]
    },
    {
      "id": "MAGIC_SWAP_LALT_LGUI",
      "label": "Swap\nLAlt\nLGui",
      "tooltip": "Swap Left Alt and GUI",
      "aliases": [
        "LAG_SWP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_LALT_LGUI",
      "label": "Unswap\nLAlt\nLGui",
      "tooltip": "Unswap Left Alt and GUI",
      "aliases": [
        "LAG_NRM"
      ]
    },
    {
      "id": "MAGIC_SWAP_RALT_RGUI",
      "label": "Swap\nRAlt\nRGui",
      "tooltip": "Swap Right Alt and GUI",
      "aliases": [
        "RAG_SWP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_RALT_RGUI",
      "label": "Unswap\nRAlt\nRGui",
      "tooltip": "Unswap Right Alt and GUI",
      "aliases": [
        "RAG_NRM"
      ]
    },
    {
      "id": "MAGIC_SWAP_ALT_GUI",
      "label": "Swap\nAlt\nGui",
      "tooltip": "Swap Alt and GUI on both sides",
      "aliases": [
        "AG_SWAP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_ALT_GUI",
      "label": "Unswap\nAlt\nGui",
      "tooltip": "Unswap Alt and GUI on both sides",
      "aliases": [
        "AG_NORM"
      ]
    },
    {
      "id": "MAGIC_TOGGLE_ALT_GUI",
      "label": "Toggle\nAlt\nGui",
      "tooltip": "Toggle Alt and GUI swap on both sides",
      "aliases": [
        "AG_TOGG"
      ]
    },
    {
      "id": "MAGIC_NO_GUI",
      "label": "GUI\nOff",
      "tooltip": "Disable the GUI keys",
      "aliases": [
        "GUI_OFF"
      ]
    },
    {
      "id": "MAGIC_UNNO_GUI",
      "label": "GUI\nOn",
      "tooltip": "Enable the GUI keys",
      "aliases": [
        "GUI_ON"
      ]
    },
    {
      "id": "MAGIC_TOGGLE_GUI",
      "label": "GUI\nToggle",
      "tooltip": "Toggle the GUI keys on and off",
      "aliases": [
        "GUI_TOGG"
      ]
    },
    {
      "id": "MAGIC_SWAP_GRAVE_ESC",
      "label": "Swap\n`\nEsc",
      "tooltip": "Swap ` and Escape",
      "aliases": [
        "GE_SWAP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_GRAVE_ESC",
      "label": "Unswap\n`\nEsc",
      "tooltip": "Unswap ` and Escape",
      "aliases": [
        "GE_NORM"
      ]
    },
    {
      "id": "MAGIC_SWAP_BACKSLASH_BACKSPACE",
      "label": "Swap\n\\\nBS",
      "tooltip": "Swap \\ and Backspace",
      "aliases": [
        "BS_SWAP"
      ]
    },
    {
      "id": "MAGIC_UNSWAP_BACKSLASH_BACKSPACE",
      "label": "Unswap\n\\\nBS",
      "tooltip": "Unswap \\ and Backspace",
      "aliases": [
        "BS_NORM"
      ]
    },
    {
      "id": "MAGIC_HOST_NKRO",
      "label": "NKRO\nOn",
      "tooltip": "Enable N-key rollover",
      "aliases": [
        "NK_ON"
      ]
    },
    {
      "id": "MAGIC_UNHOST_NKRO",
      "label": "NKRO\nOff",
      "tooltip": "Disable N-key rollover",
      "aliases": [
        "NK_OFF"
      ]
    },
    {
      "id": "MAGIC_TOGGLE_NKRO",
      "label": "NKRO\nToggle",
      "tooltip": "Toggle N-key rollover",
      "aliases": [
        "NK_TOGG"
      ]
    },
    {
      "id": "MAGIC_EE_HANDS_LEFT",
      "label": "EEH\nLeft",
      "tooltip": "Set the master half of a split keyboard as the left hand (for EE_HANDS)",
      "aliases": [
        "EH_LEFT"
      ]
    },
    {
      "id": "MAGIC_EE_HANDS_RIGHT",
      "label": "EEH\nRight",
      "tooltip": "Set the master half of a split keyboard as the right hand (for EE_HANDS)",
      "aliases": [
        "EH_RGHT"
      ]
    },
    {
      "id": "AU_ON",
      "label": "Audio\nON",
      "tooltip": "Audio mode on"
    },
    {
      "id": "AU_OFF",
      "label": "Audio\nOFF",
      "tooltip": "Audio mode off"
    },
    {
      "id": "AU_TOG",
      "label": "Audio\nToggle",
      "tooltip": "Toggles Audio mode"
    },
    {
      "id": "CLICKY_TOGGLE",
      "label": "Clicky\nToggle",
      "tooltip": "Toggles Audio clicky mode",
      "aliases": [
        "CK_TOGG"
      ]
    },
    {
      "id": "CLICKY_UP",
      "label": "Clicky\nUp",
      "tooltip": "Increases frequency of the clicks",
      "aliases": [
        "CK_UP"
      ]
    },
    {
      "id": "CLICKY_DOWN",
      "label": "Clicky\nDown",
      "tooltip": "Decreases frequency of the clicks",
      "aliases": [
        "CK_DOWN"
      ]
    },
    {
      "id": "CLICKY_RESET",
      "label": "Clicky\nReset",
      "tooltip": "Resets frequency to default",
      "aliases": [
        "CK_RST"
      ]
    },
    {
      "id": "MU_ON",
      "label": "Music\nOn",
      "tooltip": "Turns on Music Mode"
    },
    {
      "id": "MU_OFF",
      "label": "Music\nOff",
      "tooltip": "Turns off Music Mode"
    },
    {
      "id": "MU_TOG",
      "label": "Music\nToggle",
      "tooltip": "Toggles Music Mode"
    },
    {
      "id": "MU_MOD",
      "label": "Music\nCycle",
      "tooltip": "Cycles through the music modes"
    },
    {
      "id": "HPT_ON",
      "label": "Haptic\nOn",
      "tooltip": "Turn haptic feedback on"
    },
    {
      "id": "HPT_OFF",
      "label": "Haptic\nOff",
      "tooltip": "Turn haptic feedback off"
    },
    {
      "id": "HPT_TOG",
      "label": "Haptic\nToggle",
      "tooltip": "Toggle haptic feedback on/off"
    },
    {
      "id": "HPT_RST",
      "label": "Haptic\nReset",
      "tooltip": "Reset haptic feedback config to default"
    },
    {
      "id": "HPT_FBK",
      "label": "Haptic\nFeed\nback",
      "tooltip": "Toggle feedback to occur on keypress, release or both"
    },
    {
      "id": "HPT_BUZ",
      "label": "Haptic\nBuzz",
      "tooltip": "Toggle solenoid buzz on/off"
    },
    {
      "id": "HPT_MODI",
      "label": "Haptic\nNext",
      "tooltip": "Go to next DRV2605L waveform"
    },
    {
      "id": "HPT_MODD",
      "label": "Haptic\nPrev",
      "tooltip": "Go to previous DRV2605L waveform"
    },
    {
      "id": "HPT_CONT",
      "label": "Haptic\nCont.",
      "tooltip": "Toggle continuous haptic mode on/off"
    },
    {
      "id": "HPT_CONI",
      "label": "Haptic\n+",
      "tooltip": "Increase DRV2605L continous haptic strength"
    },
    {
      "id": "HPT_COND",
      "label": "Haptic\n-",
      "tooltip": "Decrease DRV2605L continous haptic strength"
    },
    {
      "id": "HPT_DWLI",
      "label": "Haptic\nDwell+",
      "tooltip": "Increase Solenoid dwell time"
    },
    {
      "id": "HPT_DWLD",
      "label": "Haptic\nDwell-",
      "tooltip": "Decrease Solenoid dwell time"
    },
    {
      "id": "KC_ASDN",
      "label": "Auto-\nshift\nDown",
      "tooltip": "Lower the Auto Shift timeout variable (down)"
    },
    {
      "id": "KC_ASUP",
      "label": "Auto-\nshift\nUp",
      "tooltip": "Raise the Auto Shift timeout variable (up)"
    },
    {
      "id": "KC_ASRP",
      "label": "Auto-\nshift\nReport",
      "tooltip": "Report your current Auto Shift timeout value"
    },
    {
      "id": "KC_ASON",
      "label": "Auto-\nshift\nOn",
      "tooltip": "Turns on the Auto Shift Function"
    },
    {
      "id": "KC_ASOFF",
      "label": "Auto-\nshift\nOff",
      "tooltip": "Turns off the Auto Shift Function"
    },
    {
      "id": "KC_ASTG",
      "label": "Auto-\nshift\nToggle",
      "tooltip": "Toggles the state of the Auto Shift feature"
    },
    {
      "id": "CMB_ON",
      "label": "Combo\nOn",
      "tooltip": "Turns on Combo feature"
    },
    {
      "id": "CMB_OFF",
      "label": "Combo\nOff",
      "tooltip": "Turns off Combo feature"
    },
    {
      "id": "CMB_TOG",
      "label": "Combo\nToggle",
      "tooltip": "Toggles Combo feature on and off"
    },
    {
      "id": "QK_CAPS_WORD_TOGGLE",
      "label": "Caps\nWord",
      "tooltip": "Capitalizes until end of current word",
      "aliases": [
        "CW_TOGG"
      ],
      "feature": "caps_word"
    },
    {
      "id": "QK_REPEAT_KEY",
      "label": "Repeat",
      "tooltip": "Repeats the last pressed key",
      "aliases": [
        "QK_REP"
      ],
      "feature": "repeat_key"
    },
    {
      "id": "QK_ALT_REPEAT_KEY",
      "label": "Alt\nRepeat",
      "tooltip": "Alt repeats the last pressed key",
      "aliases": [
        "QK_AREP"
      ],
      "feature": "repeat_key"
    }
  ],
  "backlight": [
    {
      "id": "BL_TOGG",
      "label": "BL\nToggle",
      "tooltip": "Turn the backlight on or off"
    },
    {
      "id": "BL_STEP",
      "label": "BL\nCycle",
      "tooltip": "Cycle through backlight levels"
    },
    {
      "id": "BL_BRTG",
      "label": "BL\nBreath",
      "tooltip": "Toggle backlight breathing"
    },
    {
      "id": "BL_ON",
      "label": "BL On",
      "tooltip": "Set the backlight to max brightness"
    },
    {
      "id": "BL_OFF",
      "label": "BL Off",
      "tooltip": "Turn the backlight off"
    },
    {
      "id": "BL_INC",
      "label": "BL +",
      "tooltip": "Increase the backlight level"
    },
    {
      "id": "BL_DEC",
      "label": "BL - ",
      "tooltip": "Decrease the backlight level"
    },
    {
      "id": "RGB_TOG",
      "label": "RGB\nToggle",
      "tooltip": "Toggle RGB lighting on or off"
    },
    {
      "id": "RGB_MOD",
      "label": "RGB\nMode +",
      "tooltip": "Next RGB mode"
    },
    {
      "id": "RGB_RMOD",
      "label": "RGB\nMode -",
      "tooltip": "Previous RGB mode"
    },
    {
      "id": "RGB_HUI",
      "label": "Hue +",
      "tooltip": "Increase hue"
    },
    {
      "id": "RGB_HUD",
      "label": "Hue -",
      "tooltip": "Decrease hue"
    },
    {
      "id": "RGB_SAI",
      "label": "Sat +",
      "tooltip": "Increase saturation"
    },
    {
      "id": "RGB_SAD",
      "label": "Sat -",
      "tooltip": "Decrease saturation"
    },
    {
      "id": "RGB_VAI",
      "label": "Bright +",
      "tooltip": "Increase value"
    },
    {
      "id": "RGB_VAD",
      "label": "Bright -",
      "tooltip": "Decrease value"
    },
    {
      "id": "RGB_SPI",
      "label": "Effect +",
      "tooltip": "Increase RGB effect speed"
    },
    {
      "id": "RGB_SPD",
      "label": "Effect -",
      "tooltip": "Decrease RGB effect speed"
    },
    {
      "id": "RGB_M_P",
      "label": "RGB\nMode P",
      "tooltip": "RGB Mode: Plain"
    },
    {
      "id": "RGB_M_B",
      "label": "RGB\nMode B",
      "tooltip": "RGB Mode: Breathe"
    },
    {
      "id": "RGB_M_R",
      "label": "RGB\nMode R",
      "tooltip": "RGB Mode: Rainbow"
    },
    {
      "id": "RGB_M_SW",
      "label": "RGB\nMode SW",
      "tooltip": "RGB Mode: Swirl"
    },
    {
      "id": "RGB_M_SN",
      "label": "RGB\nMode SN",
      "tooltip": "RGB Mode: Snake"
    },
    {
      "id": "RGB_M_K",
      "label": "RGB\nMode K",
      "tooltip": "RGB Mode: Knight Rider"
    },
    {
      "id": "RGB_M_X",
      "label": "RGB\nMode X",
      "tooltip": "RGB Mode: Christmas"
    },
    {
      "id": "RGB_M_G",
      "label": "RGB\nMode G",
      "tooltip": "RGB Mode: Gradient"
    },
    {
      "id": "RGB_M_T",
      "label": "RGB\nMode T",
      "tooltip": "RGB Mode: Test"
    },
    {
      "id": "RM_ON",
      "label": "RGBM\nOn",
      "tooltip": "Turn on RGB Matrix"
    },
    {
      "id": "RM_OFF",
      "label": "RGBM\nOff",
      "tooltip": "Turn off RGB Matrix"
    },
    {
      "id": "RM_TOGG",
      "label": "RGBM\nTogg",
      "tooltip": "Toggle RGB Matrix on or off"
    },
    {
      "id": "RM_NEXT",
      "label": "RGBM\nNext",
      "tooltip": "Cycle through animations"
    },
    {
      "id": "RM_PREV",
      "label": "RGBM\nPrev",
      "tooltip": "Cycle through animations in reverse"
    },
    {
      "id": "RM_HUEU",
      "label": "RGBM\nHue +",
      "tooltip": "Cycle through hue"
    },
    {
      "id": "RM_HUED",
      "label": "RGBM\nHue -",
      "tooltip": "Cycle through hue in reverse"
    },
    {
      "id": "RM_SATU",
      "label": "RGBM\nSat +",
      "tooltip": "Increase the saturation"
    },
    {
      "id": "RM_SATD",
      "label": "RGBM\nSat -",
      "tooltip": "Decrease the saturation"
    },
    {
      "id": "RM_VALU",
      "label": "RGBM\nBright +",
      "tooltip": "Increase the brightness level"
    },
    {
      "id": "RM_VALD",
      "label": "RGBM\nBright -",
      "tooltip": "Decrease the brightness level"
    },
    {
      "id": "RM_SPDU",
      "label": "RGBM\nSpeed +",
      "tooltip": "Increase the animation speed"
    },
    {
      "id": "RM_SPDD",
      "label": "RGBM\nSpeed -",
      "tooltip": "Decrease the animation speed"
    }
  ],
  "media": [
    {
      "id": "KC_F13",
      "label": "F13"
    },
    {
      "id": "KC_F14",
      "label": "F14"
    },
    {
      "id": "KC_F15",
      "label": "F15"
    },
    {
      "id": "KC_F16",
      "label": "F16"
    },
    {
      "id": "KC_F17",
      "label": "F17"
    },
    {
      "id": "KC_F18",
      "label": "F18"
    },
    {
      "id": "KC_F19",
      "label": "F19"
    },
    {
      "id": "KC_F20",
      "label": "F20"
    },
    {
      "id": "KC_F21",
      "label": "F21"
    },
    {
      "id": "KC_F22",
      "label": "F22"
    },
    {
      "id": "KC_F23",
      "label": "F23"
    },
    {
      "id": "KC_F24",
      "label": "F24"
    },
    {
      "id": "KC_PWR",
      "label": "Power",
      "tooltip": "System Power Down",
      "aliases": [
        "KC_SYSTEM_POWER"
      ]
    },
    {
      "id": "KC_SLEP",
      "label": "Sleep",
      "tooltip": "System Sleep",
      "aliases": [
        "KC_SYSTEM_SLEEP"
      ]
    },
    {
      "id": "KC_WAKE",
      "label": "Wake",
      "tooltip": "System Wake",
      "aliases": [
        "KC_SYSTEM_WAKE"
      ]
    },
    {
      "id": "KC_EXEC",
      "label": "Exec",
      "tooltip": "Execute",
      "aliases": [
        "KC_EXECUTE"
      ]
    },
    {
      "id": "KC_HELP",
      "label": "Help"
    },
    {
      "id": "KC_SLCT",
      "label": "Select",
      "aliases": [
        "KC_SELECT"
      ]
    },
    {
      "id": "KC_STOP",
      "label": "Stop"
    },
    {
      "id": "KC_AGIN",
      "label": "Again",
      "aliases": [
        "KC_AGAIN"
      ]
    },
    {
      "id": "KC_UNDO",
      "label": "Undo"
    },
    {
      "id": "KC_CUT",
      "label": "Cut"
    },
    {
      "id": "KC_COPY",
      "label": "Copy"
    },
    {
      "id": "KC_PSTE",
      "label": "Paste",
      "aliases": [
        "KC_PASTE"
      ]
    },
    {
      "id": "KC_FIND",
      "label": "Find"
    },
    {
      "id": "KC_CALC",
      "label": "Calc",
      "tooltip": "Launch Calculator (Windows)",
      "aliases": [
        "KC_CALCULATOR"
      ]
    },
    {
      "id": "KC_MAIL",
      "label": "Mail",
      "tooltip": "Launch Mail (Windows)"
    },
    {
      "id": "KC_MSEL",
      "label": "Media\nPlayer",
      "tooltip": "Launch Media Player (Windows)",
      "aliases": [
        "KC_MEDIA_SELECT"
      ]
    },
    {
      "id": "KC_MYCM",
      "label": "My\nPC",
      "tooltip": "Launch My Computer (Windows)",
      "aliases": [
        "KC_MY_COMPUTER"
      ]
    },
    {
      "id": "KC_WSCH",
      "label": "Browser\nSearch",
      "tooltip": "Browser Search (Windows)",
      "aliases": [
        "KC_WWW_SEARCH"
      ]
    },
    {
      "id": "KC_WHOM",
      "label": "Browser\nHome",
      "tooltip": "Browser Home (Windows)",
      "aliases": [
        "KC_WWW_HOME"
      ]
    },
    {
      "id": "KC_WBAK",
      "label": "Browser\nBack",
      "tooltip": "Browser Back (Windows)",
      "aliases": [
        "KC_WWW_BACK"
      ]
    },
    {
      "id": "KC_WFWD",
      "label": "Browser\nForward",
      "tooltip": "Browser Forward (Windows)",
      "aliases": [
        "KC_WWW_FORWARD"
      ]
    },
    {
      "id": "KC_WSTP",
      "label": "Browser\nStop",
      "tooltip": "Browser Stop (Windows)",
      "aliases": [
        "KC_WWW_STOP"
      ]
    },
    {
      "id": "KC_WREF",
      "label": "Browser\nRefresh",
      "tooltip": "Browser Refresh (Windows)",
      "aliases": [
        "KC_WWW_REFRESH"
      ]
    },
    {
      "id": "KC_WFAV",
      "label": "Browser\nFav.",
      "tooltip": "Browser Favorites (Windows)",
      "aliases": [
        "KC_WWW_FAVORITES"
      ]
    },
    {
      "id": "KC_BRIU",
      "label": "Bright.\nUp",
      "tooltip": "Increase the brightness of screen (Laptop)",
      "aliases": [
        "KC_BRIGHTNESS_UP"
      ]
    },
    {
      "id": "KC_BRID",
      "label": "Bright.\nDown",
      "tooltip": "Decrease the brightness of screen (Laptop)",
      "aliases": [
        "KC_BRIGHTNESS_DOWN"
      ]
    },
    {
      "id": "KC_MPRV",
      "label": "Media\nPrev",
      "tooltip": "Previous Track",
      "aliases": [
        "KC_MEDIA_PREV_TRACK"
      ]
    },
    {
      "id": "KC_MNXT",
      "label": "Media\nNext",
      "tooltip": "Next Track",
      "aliases": [
        "KC_MEDIA_NEXT_TRACK"
      ]
    },
    {
      "id": "KC_MUTE",
      "label": "Mute",
      "tooltip": "Mute Audio",
      "aliases": [
        "KC_AUDIO_MUTE"
      ]
    },
    {
      "id": "KC_VOLD",
      "label": "Vol -",
      "tooltip": "Volume Down",
      "aliases": [
        "KC_AUDIO_VOL_DOWN"
      ]
    },
    {
      "id": "KC_VOLU",
      "label": "Vol +",
      "tooltip": "Volume Up",
      "aliases": [
        "KC_AUDIO_VOL_UP"
      ]
    },
    {
      "id": "KC__VOLDOWN",
      "label": "Vol -\nAlt",
      "tooltip": "Volume Down Alternate"
    },
    {
      "id": "KC__VOLUP",
      "label": "Vol +\nAlt",
      "tooltip": "Volume Up Alternate"
    },
    {
      "id": "KC_MSTP",
      "label": "Media\nStop",
      "aliases": [
        "KC_MEDIA_STOP"
      ]
    },
    {
      "id": "KC_MPLY",
      "label": "Media\nPlay",
      "tooltip": "Play/Pause",
      "aliases": [
        "KC_MEDIA_PLAY_PAUSE"
      ]
    },
    {
      "id": "KC_MRWD",
      "label": "Prev\nTrack\n(macOS)",
      "tooltip": "Previous Track / Rewind (macOS)",
      "aliases": [
        "KC_MEDIA_REWIND"
      ]
    },
    {
      "id": "KC_MFFD",
      "label": "Next\nTrack\n(macOS)",
      "tooltip": "Next Track / Fast Forward (macOS)",
      "aliases": [
        "KC_MEDIA_FAST_FORWARD"
      ]
    },
    {
      "id": "KC_EJCT",
      "label": "Eject",
      "tooltip": "Eject (macOS)",
      "aliases": [
        "KC_MEDIA_EJECT"
      ]
    },
    {
      "id": "KC_MS_U",
      "label": "Mouse\nUp",
      "tooltip": "Mouse Cursor Up",
      "aliases": [
        "KC_MS_UP"
      ]
    },
    {
      "id": "KC_MS_D",
      "label": "Mouse\nDown",
      "tooltip": "Mouse Cursor Down",
      "aliases": [
        "KC_MS_DOWN"
      ]
    },
    {
      "id": "KC_MS_L",
      "label": "Mouse\nLeft",
      "tooltip": "Mouse Cursor Left",
      "aliases": [
        "KC_MS_LEFT"
      ]
    },
    {
      "id": "KC_MS_R",
      "label": "Mouse\nRight",
      "tooltip": "Mouse Cursor Right",
      "aliases": [
        "KC_MS_RIGHT"
      ]
    },
    {
      "id": "KC_BTN1",
      "label": "Mouse\n1",
      "tooltip": "Mouse Button 1",
      "aliases": [
        "KC_MS_BTN1"
      ]
    },
    {
      "id": "KC_BTN2",
      "label": "Mouse\n2",
      "tooltip": "Mouse Button 2",
      "aliases": [
        "KC_MS_BTN2"
      ]
    },
    {
      "id": "KC_BTN3",
      "label": "Mouse\n3",
      "tooltip": "Mouse Button 3",
      "aliases": [
        "KC_MS_BTN3"
      ]
    },
    {
      "id": "KC_BTN4",
      "label": "Mouse\n4",
      "tooltip": "Mouse Button 4",
      "aliases": [
        "KC_MS_BTN4"
      ]
    },
    {
      "id": "KC_BTN5",
      "label": "Mouse\n5",
      "tooltip": "Mouse Button 5",
      "aliases": [
        "KC_MS_BTN5"
      ]
    },
    {
      "id": "KC_WH_U",
      "label": "Mouse\nWheel\nUp",
      "aliases": [
        "KC_MS_WH_UP"
      ]
    },
    {
      "id": "KC_WH_D",
      "label": "Mouse\nWheel\nDown",
      "aliases": [
        "KC_MS_WH_DOWN"
      ]
    },
    {
      "id": "KC_WH_L",
      "label": "Mouse\nWheel\nLeft",
      "aliases": [
        "KC_MS_WH_LEFT"
      ]
    },
    {
      "id": "KC_WH_R",
      "label": "Mouse\nWheel\nRight",
      "aliases": [
        "KC_MS_WH_RIGHT"
      ]
    },
    {
      "id": "KC_ACL0",
      "label": "Mouse\nAccel\n0",
      "tooltip": "Set mouse acceleration to 0",
      "aliases": [
        "KC_MS_ACCEL0"
      ]
    },
    {
      "id": "KC_ACL1",
      "label": "Mouse\nAccel\n1",
      "tooltip": "Set mouse acceleration to 1",
      "aliases": [
        "KC_MS_ACCEL1"
      ]
    },
    {
      "id": "KC_ACL2",
      "label": "Mouse\nAccel\n2",
      "tooltip": "Set mouse acceleration to 2",
      "aliases": [
        "KC_MS_ACCEL2"
      ]
    },
    {
      "id": "KC_LCAP",
      "label": "Locking\nCaps",
      "tooltip": "Locking Caps Lock",
      "aliases": [
        "KC_LOCKING_CAPS"
      ]
    },
    {
      "id": "KC_LNUM",
      "label": "Locking\nNum",
      "tooltip": "Locking Num Lock",
      "aliases": [
        "KC_LOCKING_NUM"
      ]
    },
    {
      "id": "KC_LSCR",
      "label": "Locking\nScroll",
      "tooltip": "Locking Scroll Lock",
      "aliases": [
        "KC_LOCKING_SCROLL"
      ]
    }
  ],
  "macroBase": [
    {
      "id": "DYN_REC_START1",
      "label": "DM1\nRec",
      "tooltip": "Dynamic Macro 1 Rec Start",
      "aliases": [
        "DM_REC1"
      ]
    },
    {
      "id": "DYN_REC_START2",
      "label": "DM2\nRec",
      "tooltip": "Dynamic Macro 2 Rec Start",
      "aliases": [
        "DM_REC2"
      ]
    },
    {
      "id": "DYN_REC_STOP",
      "label": "DM Rec\nStop",
      "tooltip": "Dynamic Macro Rec Stop",
      "aliases": [
        "DM_RSTP"
      ]
    },
    {
      "id": "DYN_MACRO_PLAY1",
      "label": "DM1\nPlay",
      "tooltip": "Dynamic Macro 1 Play",
      "aliases": [
        "DM_PLY1"
      ]
    },
    {
      "id": "DYN_MACRO_PLAY2",
      "label": "DM2\nPlay",
      "tooltip": "Dynamic Macro 2 Play",
      "aliases": [
        "DM_PLY2"
      ]
    }
  ],
  "midiBasic": [
    {
      "id": "MI_C",
      "label": "ᴹᴵᴰᴵ\nC",
      "tooltip": "Midi send note C"
    },
    {
      "id": "MI_Cs",
      "label": "ᴹᴵᴰᴵ\nC#/Dᵇ",
      "tooltip": "Midi send note C#/Dᵇ",
      "aliases": [
        "MI_Db"
      ]
    },
    {
      "id": "MI_D",
      "label": "ᴹᴵᴰᴵ\nD",
      "tooltip": "Midi send note D"
    },
    {
      "id": "MI_Ds",
      "label": "ᴹᴵᴰᴵ\nD#/Eᵇ",
      "tooltip": "Midi send note D#/Eᵇ",
      "aliases": [
        "MI_Eb"
      ]
    },
    {
      "id": "MI_E",
      "label": "ᴹᴵᴰᴵ\nE",
      "tooltip": "Midi send note E"
    },
    {
      "id": "MI_F",
      "label": "ᴹᴵᴰᴵ\nF",
      "tooltip": "Midi send note F"
    },
    {
      "id": "MI_Fs",
      "label": "ᴹᴵᴰᴵ\nF#/Gᵇ",
      "tooltip": "Midi send note F#/Gᵇ",
      "aliases": [
        "MI_Gb"
      ]
    },
    {
      "id": "MI_G",
      "label": "ᴹᴵᴰᴵ\nG",
      "tooltip": "Midi send note G"
    },
    {
      "id": "MI_Gs",
      "label": "ᴹᴵᴰᴵ\nG#/Aᵇ",
      "tooltip": "Midi send note G#/Aᵇ",
      "aliases": [
        "MI_Ab"
      ]
    },
    {
      "id": "MI_A",
      "label": "ᴹᴵᴰᴵ\nA",
      "tooltip": "Midi send note A"
    },
    {
      "id": "MI_As",
      "label": "ᴹᴵᴰᴵ\nA#/Bᵇ",
      "tooltip": "Midi send note A#/Bᵇ",
      "aliases": [
        "MI_Bb"
      ]
    },
    {
      "id": "MI_B",
      "label": "ᴹᴵᴰᴵ\nB",
      "tooltip": "Midi send note B"
    },
    {
      "id": "MI_C_1",
      "label": "ᴹᴵᴰᴵ\nC₁",
      "tooltip": "Midi send note C₁"
    },
    {
      "id": "MI_Cs_1",
      "label": "ᴹᴵᴰᴵ\nC#₁/Dᵇ₁",
      "tooltip": "Midi send note C#₁/Dᵇ₁",
      "aliases": [
        "MI_Db_1"
      ]
    },
    {
      "id": "MI_D_1",
      "label": "ᴹᴵᴰᴵ\nD₁",
      "tooltip": "Midi send note D₁"
    },
    {
      "id": "MI_Ds_1",
      "label": "ᴹᴵᴰᴵ\nD#₁/Eᵇ₁",
      "tooltip": "Midi send note D#₁/Eᵇ₁",
      "aliases": [
        "MI_Eb_1"
      ]
    },
    {
      "id": "MI_E_1",
      "label": "ᴹᴵᴰᴵ\nE₁",
      "tooltip": "Midi send note E₁"
    },
    {
      "id": "MI_F_1",
      "label": "ᴹᴵᴰᴵ\nF₁",
      "tooltip": "Midi send note F₁"
    },
    {
      "id": "MI_Fs_1",
      "label": "ᴹᴵᴰᴵ\nF#₁/Gᵇ₁",
      "tooltip": "Midi send note F#₁/Gᵇ₁",
      "aliases": [
        "MI_Gb_1"
      ]
    },
    {
      "id": "MI_G_1",
      "label": "ᴹᴵᴰᴵ\nG₁",
      "tooltip": "Midi send note G₁"
    },
    {
      "id": "MI_Gs_1",
      "label": "ᴹᴵᴰᴵ\nG#₁/Aᵇ₁",
      "tooltip": "Midi send note G#₁/Aᵇ₁",
      "aliases": [
        "MI_Ab_1"
      ]
    },
    {
      "id": "MI_A_1",
      "label": "ᴹᴵᴰᴵ\nA₁",
      "tooltip": "Midi send note A₁"
    },
    {
      "id": "MI_As_1",
      "label": "ᴹᴵᴰᴵ\nA#₁/Bᵇ₁",
      "tooltip": "Midi send note A#₁/Bᵇ₁",
      "aliases": [
        "MI_Bb_1"
      ]
    },
    {
      "id": "MI_B_1",
      "label": "ᴹᴵᴰᴵ\nB₁",
      "tooltip": "Midi send note B₁"
    },
    {
      "id": "MI_C_2",
      "label": "ᴹᴵᴰᴵ\nC₂",
      "tooltip": "Midi send note C₂"
    },
    {
      "id": "MI_Cs_2",
      "label": "ᴹᴵᴰᴵ\nC#₂/Dᵇ₂",
      "tooltip": "Midi send note C#₂/Dᵇ₂",
      "aliases": [
        "MI_Db_2"
      ]
    },
    {
      "id": "MI_D_2",
      "label": "ᴹᴵᴰᴵ\nD₂",
      "tooltip": "Midi send note D₂"
    },
    {
      "id": "MI_Ds_2",
      "label": "ᴹᴵᴰᴵ\nD#₂/Eᵇ₂",
      "tooltip": "Midi send note D#₂/Eᵇ₂",
      "aliases": [
        "MI_Eb_2"
      ]
    },
    {
      "id": "MI_E_2",
      "label": "ᴹᴵᴰᴵ\nE₂",
      "tooltip": "Midi send note E₂"
    },
    {
      "id": "MI_F_2",
      "label": "ᴹᴵᴰᴵ\nF₂",
      "tooltip": "Midi send note F₂"
    },
    {
      "id": "MI_Fs_2",
      "label": "ᴹᴵᴰᴵ\nF#₂/Gᵇ₂",
      "tooltip": "Midi send note F#₂/Gᵇ₂",
      "aliases": [
        "MI_Gb_2"
      ]
    },
    {
      "id": "MI_G_2",
      "label": "ᴹᴵᴰᴵ\nG₂",
      "tooltip": "Midi send note G₂"
    },
    {
      "id": "MI_Gs_2",
      "label": "ᴹᴵᴰᴵ\nG#₂/Aᵇ₂",
      "tooltip": "Midi send note G#₂/Aᵇ₂",
      "aliases": [
        "MI_Ab_2"
      ]
    },
    {
      "id": "MI_A_2",
      "label": "ᴹᴵᴰᴵ\nA₂",
      "tooltip": "Midi send note A₂"
    },
    {
      "id": "MI_As_2",
      "label": "ᴹᴵᴰᴵ\nA#₂/Bᵇ₂",
      "tooltip": "Midi send note A#₂/Bᵇ₂",
      "aliases": [
        "MI_Bb_2"
      ]
    },
    {
      "id": "MI_B_2",
      "label": "ᴹᴵᴰᴵ\nB₂",
      "tooltip": "Midi send note B₂"
    },
    {
      "id": "MI_C_3",
      "label": "ᴹᴵᴰᴵ\nC₃",
      "tooltip": "Midi send note C₃"
    },
    {
      "id": "MI_Cs_3",
      "label": "ᴹᴵᴰᴵ\nC#₃/Dᵇ₃",
      "tooltip": "Midi send note C#₃/Dᵇ₃",
      "aliases": [
        "MI_Db_3"
      ]
    },
    {
      "id": "MI_D_3",
      "label": "ᴹᴵᴰᴵ\nD₃",
      "tooltip": "Midi send note D₃"
    },
    {
      "id": "MI_Ds_3",
      "label": "ᴹᴵᴰᴵ\nD#₃/Eᵇ₃",
      "tooltip": "Midi send note D#₃/Eᵇ₃",
      "aliases": [
        "MI_Eb_3"
      ]
    },
    {
      "id": "MI_E_3",
      "label": "ᴹᴵᴰᴵ\nE₃",
      "tooltip": "Midi send note E₃"
    },
    {
      "id": "MI_F_3",
      "label": "ᴹᴵᴰᴵ\nF₃",
      "tooltip": "Midi send note F₃"
    },
    {
      "id": "MI_Fs_3",
      "label": "ᴹᴵᴰᴵ\nF#₃/Gᵇ₃",
      "tooltip": "Midi send note F#₃/Gᵇ₃",
      "aliases": [
        "MI_Gb_3"
      ]
    },
    {
      "id": "MI_G_3",
      "label": "ᴹᴵᴰᴵ\nG₃",
      "tooltip": "Midi send note G₃"
    },
    {
      "id": "MI_Gs_3",
      "label": "ᴹᴵᴰᴵ\nG#₃/Aᵇ₃",
      "tooltip": "Midi send note G#₃/Aᵇ₃",
      "aliases": [
        "MI_Ab_3"
      ]
    },
    {
      "id": "MI_A_3",
      "label": "ᴹᴵᴰᴵ\nA₃",
      "tooltip": "Midi send note A₃"
    },
    {
      "id": "MI_As_3",
      "label": "ᴹᴵᴰᴵ\nA#₃/Bᵇ₃",
      "tooltip": "Midi send note A#₃/Bᵇ₃",
      "aliases": [
        "MI_Bb_3"
      ]
    },
    {
      "id": "MI_B_3",
      "label": "ᴹᴵᴰᴵ\nB₃",
      "tooltip": "Midi send note B₃"
    },
    {
      "id": "MI_C_4",
      "label": "ᴹᴵᴰᴵ\nC₄",
      "tooltip": "Midi send note C₄"
    },
    {
      "id": "MI_Cs_4",
      "label": "ᴹᴵᴰᴵ\nC#₄/Dᵇ₄",
      "tooltip": "Midi send note C#₄/Dᵇ₄",
      "aliases": [
        "MI_Db_4"
      ]
    },
    {
      "id": "MI_D_4",
      "label": "ᴹᴵᴰᴵ\nD₄",
      "tooltip": "Midi send note D₄"
    },
    {
      "id": "MI_Ds_4",
      "label": "ᴹᴵᴰᴵ\nD#₄/Eᵇ₄",
      "tooltip": "Midi send note D#₄/Eᵇ₄",
      "aliases": [
        "MI_Eb_4"
      ]
    },
    {
      "id": "MI_E_4",
      "label": "ᴹᴵᴰᴵ\nE₄",
      "tooltip": "Midi send note E₄"
    },
    {
      "id": "MI_F_4",
      "label": "ᴹᴵᴰᴵ\nF₄",
      "tooltip": "Midi send note F₄"
    },
    {
      "id": "MI_Fs_4",
      "label": "ᴹᴵᴰᴵ\nF#₄/Gᵇ₄",
      "tooltip": "Midi send note F#₄/Gᵇ₄",
      "aliases": [
        "MI_Gb_4"
      ]
    },
    {
      "id": "MI_G_4",
      "label": "ᴹᴵᴰᴵ\nG₄",
      "tooltip": "Midi send note G₄"
    },
    {
      "id": "MI_Gs_4",
      "label": "ᴹᴵᴰᴵ\nG#₄/Aᵇ₄",
      "tooltip": "Midi send note G#₄/Aᵇ₄",
      "aliases": [
        "MI_Ab_4"
      ]
    },
    {
      "id": "MI_A_4",
      "label": "ᴹᴵᴰᴵ\nA₄",
      "tooltip": "Midi send note A₄"
    },
    {
      "id": "MI_As_4",
      "label": "ᴹᴵᴰᴵ\nA#₄/Bᵇ₄",
      "tooltip": "Midi send note A#₄/Bᵇ₄",
      "aliases": [
        "MI_Bb_4"
      ]
    },
    {
      "id": "MI_B_4",
      "label": "ᴹᴵᴰᴵ\nB₄",
      "tooltip": "Midi send note B₄"
    },
    {
      "id": "MI_C_5",
      "label": "ᴹᴵᴰᴵ\nC₅",
      "tooltip": "Midi send note C₅"
    },
    {
      "id": "MI_Cs_5",
      "label": "ᴹᴵᴰᴵ\nC#₅/Dᵇ₅",
      "tooltip": "Midi send note C#₅/Dᵇ₅",
      "aliases": [
        "MI_Db_5"
      ]
    },
    {
      "id": "MI_D_5",
      "label": "ᴹᴵᴰᴵ\nD₅",
      "tooltip": "Midi send note D₅"
    },
    {
      "id": "MI_Ds_5",
      "label": "ᴹᴵᴰᴵ\nD#₅/Eᵇ₅",
      "tooltip": "Midi send note D#₅/Eᵇ₅",
      "aliases": [
        "MI_Eb_5"
      ]
    },
    {
      "id": "MI_E_5",
      "label": "ᴹᴵᴰᴵ\nE₅",
      "tooltip": "Midi send note E₅"
    },
    {
      "id": "MI_F_5",
      "label": "ᴹᴵᴰᴵ\nF₅",
      "tooltip": "Midi send note F₅"
    },
    {
      "id": "MI_Fs_5",
      "label": "ᴹᴵᴰᴵ\nF#₅/Gᵇ₅",
      "tooltip": "Midi send note F#₅/Gᵇ₅",
      "aliases": [
        "MI_Gb_5"
      ]
    },
    {
      "id": "MI_G_5",
      "label": "ᴹᴵᴰᴵ\nG₅",
      "tooltip": "Midi send note G₅"
    },
    {
      "id": "MI_Gs_5",
      "label": "ᴹᴵᴰᴵ\nG#₅/Aᵇ₅",
      "tooltip": "Midi send note G#₅/Aᵇ₅",
      "aliases": [
        "MI_Ab_5"
      ]
    },
    {
      "id": "MI_A_5",
      "label": "ᴹᴵᴰᴵ\nA₅",
      "tooltip": "Midi send note A₅"
    },
    {
      "id": "MI_As_5",
      "label": "ᴹᴵᴰᴵ\nA#₅/Bᵇ₅",
      "tooltip": "Midi send note A#₅/Bᵇ₅",
      "aliases": [
        "MI_Bb_5"
      ]
    },
    {
      "id": "MI_B_5",
      "label": "ᴹᴵᴰᴵ\nB₅",
      "tooltip": "Midi send note B₅"
    },
    {
      "id": "MI_ALLOFF",
      "label": "ᴹᴵᴰᴵ\nNotesᵒᶠᶠ",
      "tooltip": "Midi send all notes OFF"
    }
  ],
  "midiAdvanced": [
    {
      "id": "MI_OCT_N2",
      "label": "ᴹᴵᴰᴵ\nOct₋₂",
      "tooltip": "Midi set octave to -2"
    },
    {
      "id": "MI_OCT_N1",
      "label": "ᴹᴵᴰᴵ\nOct₋₁",
      "tooltip": "Midi set octave to -1"
    },
    {
      "id": "MI_OCT_0",
      "label": "ᴹᴵᴰᴵ\nOct₀",
      "tooltip": "Midi set octave to 0"
    },
    {
      "id": "MI_OCT_1",
      "label": "ᴹᴵᴰᴵ\nOct₊₁",
      "tooltip": "Midi set octave to 1"
    },
    {
      "id": "MI_OCT_2",
      "label": "ᴹᴵᴰᴵ\nOct₊₂",
      "tooltip": "Midi set octave to 2"
    },
    {
      "id": "MI_OCT_3",
      "label": "ᴹᴵᴰᴵ\nOct₊₃",
      "tooltip": "Midi set octave to 3"
    },
    {
      "id": "MI_OCT_4",
      "label": "ᴹᴵᴰᴵ\nOct₊₄",
      "tooltip": "Midi set octave to 4"
    },
    {
      "id": "MI_OCT_5",
      "label": "ᴹᴵᴰᴵ\nOct₊₅",
      "tooltip": "Midi set octave to 5"
    },
    {
      "id": "MI_OCT_6",
      "label": "ᴹᴵᴰᴵ\nOct₊₆",
      "tooltip": "Midi set octave to 6"
    },
    {
      "id": "MI_OCT_7",
      "label": "ᴹᴵᴰᴵ\nOct₊₇",
      "tooltip": "Midi set octave to 7"
    },
    {
      "id": "MI_OCTD",
      "label": "ᴹᴵᴰᴵ\nOctᴰᴺ",
      "tooltip": "Midi move down an octave"
    },
    {
      "id": "MI_OCTU",
      "label": "ᴹᴵᴰᴵ\nOctᵁᴾ",
      "tooltip": "Midi move up an octave"
    },
    {
      "id": "MI_TRNS_N6",
      "label": "ᴹᴵᴰᴵ\nTrans₋₆",
      "tooltip": "Midi set transposition to -4 semitones"
    },
    {
      "id": "MI_TRNS_N5",
      "label": "ᴹᴵᴰᴵ\nTrans₋₅",
      "tooltip": "Midi set transposition to -5 semitones"
    },
    {
      "id": "MI_TRNS_N4",
      "label": "ᴹᴵᴰᴵ\nTrans₋₄",
      "tooltip": "Midi set transposition to -4 semitones"
    },
    {
      "id": "MI_TRNS_N3",
      "label": "ᴹᴵᴰᴵ\nTrans₋₃",
      "tooltip": "Midi set transposition to -3 semitones"
    },
    {
      "id": "MI_TRNS_N2",
      "label": "ᴹᴵᴰᴵ\nTrans₋₂",
      "tooltip": "Midi set transposition to -2 semitones"
    },
    {
      "id": "MI_TRNS_N1",
      "label": "ᴹᴵᴰᴵ\nTrans₋₁",
      "tooltip": "Midi set transposition to -1 semitones"
    },
    {
      "id": "MI_TRNS_0",
      "label": "ᴹᴵᴰᴵ\nTrans₀",
      "tooltip": "Midi set no transposition"
    },
    {
      "id": "MI_TRNS_1",
      "label": "ᴹᴵᴰᴵ\nTrans₊₁",
      "tooltip": "Midi set transposition to +1 semitones"
    },
    {
      "id": "MI_TRNS_2",
      "label": "ᴹᴵᴰᴵ\nTrans₊₂",
      "tooltip": "Midi set transposition to +2 semitones"
    },
    {
      "id": "MI_TRNS_3",
      "label": "ᴹᴵᴰᴵ\nTrans₊₃",
      "tooltip": "Midi set transposition to +3 semitones"
    },
    {
      "id": "MI_TRNS_4",
      "label": "ᴹᴵᴰᴵ\nTrans₊₄",
      "tooltip": "Midi set transposition to +4 semitones"
    },
    {
      "id": "MI_TRNS_5",
      "label": "ᴹᴵᴰᴵ\nTrans₊₅",
      "tooltip": "Midi set transposition to +5 semitones"
    },
    {
      "id": "MI_TRNS_6",
      "label": "ᴹᴵᴰᴵ\nTrans₊₆",
      "tooltip": "Midi set transposition to +6 semitones"
    },
    {
      "id": "MI_TRNSD",
      "label": "ᴹᴵᴰᴵ\nTransᴰᴺ",
      "tooltip": "Midi decrease transposition"
    },
    {
      "id": "MI_TRNSU",
      "label": "ᴹᴵᴰᴵ\nTransᵁᴾ",
      "tooltip": "Midi increase transposition"
    },
    {
      "id": "MI_VEL_1",
      "label": "ᴹᴵᴰᴵ\nVel₁",
      "tooltip": "Midi set velocity to 0",
      "aliases": [
        "MI_VEL_0"
      ]
    },
    {
      "id": "MI_VEL_2",
      "label": "ᴹᴵᴰᴵ\nVel₂",
      "tooltip": "Midi set velocity to 25"
    },
    {
      "id": "MI_VEL_3",
      "label": "ᴹᴵᴰᴵ\nVel₃",
      "tooltip": "Midi set velocity to 38"
    },
    {
      "id": "MI_VEL_4",
      "label": "ᴹᴵᴰᴵ\nVel₄",
      "tooltip": "Midi set velocity to 51"
    },
    {
      "id": "MI_VEL_5",
      "label": "ᴹᴵᴰᴵ\nVel₅",
      "tooltip": "Midi set velocity to 64"
    },
    {
      "id": "MI_VEL_6",
      "label": "ᴹᴵᴰᴵ\nVel₆",
      "tooltip": "Midi set velocity to 76"
    },
    {
      "id": "MI_VEL_7",
      "label": "ᴹᴵᴰᴵ\nVel₇",
      "tooltip": "Midi set velocity to 89"
    },
    {
      "id": "MI_VEL_8",
      "label": "ᴹᴵᴰᴵ\nVel₈",
      "tooltip": "Midi set velocity to 102"
    },
    {
      "id": "MI_VEL_9",
      "label": "ᴹᴵᴰᴵ\nVel₉",
      "tooltip": "Midi set velocity to 114"
    },
    {
      "id": "MI_VEL_10",
      "label": "ᴹᴵᴰᴵ\nVel₁₀",
      "tooltip": "Midi set velocity to 127"
    },
    {
      "id": "MI_VELD",
      "label": "ᴹᴵᴰᴵ\nVelᴰᴺ",
      "tooltip": "Midi decrease velocity"
    },
    {
      "id": "MI_VELU",
      "label": "ᴹᴵᴰᴵ\nVelᵁᴾ",
      "tooltip": "Midi increase velocity"
    },
    {
      "id": "MI_CH1",
      "label": "ᴹᴵᴰᴵ\nCH₁",
      "tooltip": "Midi set channel to 1"
    },
    {
      "id": "MI_CH2",
      "label": "ᴹᴵᴰᴵ\nCH₂",
      "tooltip": "Midi set channel to 2"
    },
    {
      "id": "MI_CH3",
      "label": "ᴹᴵᴰᴵ\nCH₃",
      "tooltip": "Midi set channel to 3"
    },
    {
      "id": "MI_CH4",
      "label": "ᴹᴵᴰᴵ\nCH₄",
      "tooltip": "Midi set channel to 4"
    },
    {
      "id": "MI_CH5",
      "label": "ᴹᴵᴰᴵ\nCH₅",
      "tooltip": "Midi set channel to 5"
    },
    {
      "id": "MI_CH6",
      "label": "ᴹᴵᴰᴵ\nCH₆",
      "tooltip": "Midi set channel to 6"
    },
    {
      "id": "MI_CH7",
      "label": "ᴹᴵᴰᴵ\nCH₇",
      "tooltip": "Midi set channel to 7"
    },
    {
      "id": "MI_CH8",
      "label": "ᴹᴵᴰᴵ\nCH₈",
      "tooltip": "Midi set channel to 8"
    },
    {
      "id": "MI_CH9",
      "label": "ᴹᴵᴰᴵ\nCH₉",
      "tooltip": "Midi set channel to 9"
    },
    {
      "id": "MI_CH10",
      "label": "ᴹᴵᴰᴵ\nCH₁₀",
      "tooltip": "Midi set channel to 10"
    },
    {
      "id": "MI_CH11",
      "label": "ᴹᴵᴰᴵ\nCH₁₁",
      "tooltip": "Midi set channel to 11"
    },
    {
      "id": "MI_CH12",
      "label": "ᴹᴵᴰᴵ\nCH₁₂",
      "tooltip": "Midi set channel to 12"
    },
    {
      "id": "MI_CH13",
      "label": "ᴹᴵᴰᴵ\nCH₁₃",
      "tooltip": "Midi set channel to 13"
    },
    {
      "id": "MI_CH14",
      "label": "ᴹᴵᴰᴵ\nCH₁₄",
      "tooltip": "Midi set channel to 14"
    },
    {
      "id": "MI_CH15",
      "label": "ᴹᴵᴰᴵ\nCH₁₅",
      "tooltip": "Midi set channel to 15"
    },
    {
      "id": "MI_CH16",
      "label": "ᴹᴵᴰᴵ\nCH₁₆",
      "tooltip": "Midi set channel to 16"
    },
    {
      "id": "MI_CHD",
      "label": "ᴹᴵᴰᴵ\nCHᴰᴺ",
      "tooltip": "Midi decrease channel"
    },
    {
      "id": "MI_CHU",
      "label": "ᴹᴵᴰᴵ\nCHᵁᴾ",
      "tooltip": "Midi increase channel"
    },
    {
      "id": "MI_SUS",
      "label": "ᴹᴵᴰᴵ\nSust",
      "tooltip": "Midi Sustain"
    },
    {
      "id": "MI_PORT",
      "label": "ᴹᴵᴰᴵ\nPort",
      "tooltip": "Midi Portmento"
    },
    {
      "id": "MI_SOST",
      "label": "ᴹᴵᴰᴵ\nSost",
      "tooltip": "Midi Sostenuto"
    },
    {
      "id": "MI_SOFT",
      "label": "ᴹᴵᴰᴵ\nSPedal",
      "tooltip": "Midi Soft Pedal"
    },
    {
      "id": "MI_LEG",
      "label": "ᴹᴵᴰᴵ\nLegat",
      "tooltip": "Midi Legato"
    },
    {
      "id": "MI_MOD",
      "label": "ᴹᴵᴰᴵ\nModul",
      "tooltip": "Midi Modulation"
    },
    {
      "id": "MI_MODSD",
      "label": "ᴹᴵᴰᴵ\nModulᴰᴺ",
      "tooltip": "Midi decrease modulation speed"
    },
    {
      "id": "MI_MODSU",
      "label": "ᴹᴵᴰᴵ\nModulᵁᴾ",
      "tooltip": "Midi increase modulation speed"
    },
    {
      "id": "MI_BENDD",
      "label": "ᴹᴵᴰᴵ\nBendᴰᴺ",
      "tooltip": "Midi bend pitch down"
    },
    {
      "id": "MI_BENDU",
      "label": "ᴹᴵᴰᴵ\nBendᵁᴾ",
      "tooltip": "Midi bend pitch up"
    }
  ]
} as const satisfies Record<string, readonly VialKeycodeDef[]>;

/** Identifiants VialRGB (≠ numéros d'effets QMK). */
export const VIALRGB_EFFECTS: readonly { readonly id: number; readonly name: string }[] = [
  {
    "id": 0,
    "name": "OFF"
  },
  {
    "id": 1,
    "name": "DIRECT"
  },
  {
    "id": 2,
    "name": "SOLID_COLOR"
  },
  {
    "id": 3,
    "name": "ALPHAS_MODS"
  },
  {
    "id": 4,
    "name": "GRADIENT_UP_DOWN"
  },
  {
    "id": 5,
    "name": "GRADIENT_LEFT_RIGHT"
  },
  {
    "id": 6,
    "name": "BREATHING"
  },
  {
    "id": 7,
    "name": "BAND_SAT"
  },
  {
    "id": 8,
    "name": "BAND_VAL"
  },
  {
    "id": 9,
    "name": "BAND_PINWHEEL_SAT"
  },
  {
    "id": 10,
    "name": "BAND_PINWHEEL_VAL"
  },
  {
    "id": 11,
    "name": "BAND_SPIRAL_SAT"
  },
  {
    "id": 12,
    "name": "BAND_SPIRAL_VAL"
  },
  {
    "id": 13,
    "name": "CYCLE_ALL"
  },
  {
    "id": 14,
    "name": "CYCLE_LEFT_RIGHT"
  },
  {
    "id": 15,
    "name": "CYCLE_UP_DOWN"
  },
  {
    "id": 16,
    "name": "RAINBOW_MOVING_CHEVRON"
  },
  {
    "id": 17,
    "name": "CYCLE_OUT_IN"
  },
  {
    "id": 18,
    "name": "CYCLE_OUT_IN_DUAL"
  },
  {
    "id": 19,
    "name": "CYCLE_PINWHEEL"
  },
  {
    "id": 20,
    "name": "CYCLE_SPIRAL"
  },
  {
    "id": 21,
    "name": "DUAL_BEACON"
  },
  {
    "id": 22,
    "name": "RAINBOW_BEACON"
  },
  {
    "id": 23,
    "name": "RAINBOW_PINWHEELS"
  },
  {
    "id": 24,
    "name": "RAINDROPS"
  },
  {
    "id": 25,
    "name": "JELLYBEAN_RAINDROPS"
  },
  {
    "id": 26,
    "name": "HUE_BREATHING"
  },
  {
    "id": 27,
    "name": "HUE_PENDULUM"
  },
  {
    "id": 28,
    "name": "HUE_WAVE"
  },
  {
    "id": 29,
    "name": "TYPING_HEATMAP"
  },
  {
    "id": 30,
    "name": "DIGITAL_RAIN"
  },
  {
    "id": 31,
    "name": "SOLID_REACTIVE_SIMPLE"
  },
  {
    "id": 32,
    "name": "SOLID_REACTIVE"
  },
  {
    "id": 33,
    "name": "SOLID_REACTIVE_WIDE"
  },
  {
    "id": 34,
    "name": "SOLID_REACTIVE_MULTIWIDE"
  },
  {
    "id": 35,
    "name": "SOLID_REACTIVE_CROSS"
  },
  {
    "id": 36,
    "name": "SOLID_REACTIVE_MULTICROSS"
  },
  {
    "id": 37,
    "name": "SOLID_REACTIVE_NEXUS"
  },
  {
    "id": 38,
    "name": "SOLID_REACTIVE_MULTINEXUS"
  },
  {
    "id": 39,
    "name": "SPLASH"
  },
  {
    "id": 40,
    "name": "MULTISPLASH"
  },
  {
    "id": 41,
    "name": "SOLID_SPLASH"
  },
  {
    "id": 42,
    "name": "SOLID_MULTISPLASH"
  },
  {
    "id": 43,
    "name": "PIXEL_RAIN"
  },
  {
    "id": 44,
    "name": "PIXEL_FRACTAL"
  }
];
