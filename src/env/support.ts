export type HidSupport = 'ok' | 'insecure-context' | 'no-webhid';

interface HidEnvironment {
  isSecureContext: boolean;
  navigator: { hid?: unknown };
}

/**
 * WebHID n'existe que dans Chromium et seulement en contexte sécurisé (https:// ou http://localhost).
 * Un serveur ouvert par l'IP du réseau local fait disparaître `navigator.hid` sans erreur : on le distingue.
 */
export function detectHidSupport(env: HidEnvironment): HidSupport {
  if (!env.isSecureContext) {
    return 'insecure-context';
  }
  return env.navigator.hid ? 'ok' : 'no-webhid';
}
