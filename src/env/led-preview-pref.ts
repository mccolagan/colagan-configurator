const STORAGE_KEY = 'colagan.ledPreview';

/** Aperçu LED en direct : activé par défaut. */
export function readLedPreview(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveLedPreview(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}
