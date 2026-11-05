// Profils connus, identifiés par l'UID Vial. Un clavier inconnu fonctionne avec des valeurs génériques.

export interface KeyboardProfile {
  readonly id: string;
  readonly layerNames: readonly string[];
}

/** Colagan V2 : VIAL_KEYBOARD_UID {0x0E, 0xDC, 0x42, 0x07, 0xFC, 0x15, 0xEE, 0xC7} lu en little-endian. */
export const COLAGAN_V2_UID = 0xc7ee15fc0742dc0en;

const COLAGAN_V2: KeyboardProfile = {
  id: 'colagan-v2',
  layerNames: ['BASE', 'FN', 'FPS', 'MMO', 'MMO UI', 'Sélecteur'],
};

export function profileFor(uid: bigint): KeyboardProfile | undefined {
  return uid === COLAGAN_V2_UID ? COLAGAN_V2 : undefined;
}

export function layerName(profile: KeyboardProfile | undefined, layer: number): string {
  return profile?.layerNames[layer] ?? String(layer);
}
