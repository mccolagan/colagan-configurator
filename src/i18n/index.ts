import fr from './fr.json';

export type MessageKey = keyof typeof fr;
type Params = Record<string, string | number>;

const dictionaries = { fr } as const;
let current: Record<MessageKey, string> = dictionaries.fr;

export function setLocale(locale: keyof typeof dictionaries): void {
  current = dictionaries[locale];
}

/** Texte traduit ; `{nom}` est remplacé par `params.nom`. */
export function t(key: MessageKey, params: Params = {}): string {
  return current[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
