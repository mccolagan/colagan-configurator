export type ThemeChoice = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'colagan.theme';

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** Thème appliqué via data-theme ; "auto" suit prefers-color-scheme (CSS). */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'auto') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la session
  }
}
