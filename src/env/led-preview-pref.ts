const STORAGE_KEY = 'colagan.ledPreview';

/** Éclairage sur le dessin : masqué, couleurs de la couche sélectionnée, ou état réel du clavier. */
export type LedDisplay = 'off' | 'layer' | 'live';

export function readLedDisplay(): LedDisplay {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'off' || value === 'live' ? value : 'layer';
  } catch {
    return 'layer';
  }
}

export function saveLedDisplay(display: LedDisplay): void {
  try {
    localStorage.setItem(STORAGE_KEY, display);
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}
