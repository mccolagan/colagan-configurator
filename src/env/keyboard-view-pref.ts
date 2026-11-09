const STORAGE_KEY = 'colagan.keyboardView';

/** Dessin du clavier : vue 3D (par défaut) ou plan SVG. */
export type KeyboardViewPref = '3d' | 'plan';

export function readKeyboardView(): KeyboardViewPref {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'plan' ? 'plan' : '3d';
  } catch {
    return '3d';
  }
}

export function saveKeyboardView(view: KeyboardViewPref): void {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}
