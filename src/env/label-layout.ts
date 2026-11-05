import type { LabelLayout } from '../keycodes/labels';

const STORAGE_KEY = 'colagan.labels';

export function readLabelLayout(): LabelLayout {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'qwerty' ? 'qwerty' : 'azerty';
  } catch {
    return 'azerty';
  }
}

export function saveLabelLayout(layout: LabelLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}
