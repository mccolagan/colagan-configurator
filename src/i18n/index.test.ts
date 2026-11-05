import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('renvoie le texte français', () => {
    expect(t('app.title')).toBe('Colagan Configurator');
  });

  it('remplace les paramètres et laisse les inconnus intacts', () => {
    expect(t('connect.opened', { name: 'Colagan V2', vid: 'feed', pid: '0004' })).toBe(
      'Connecté à « Colagan V2 » (feed:0004).',
    );
    expect(t('connect.error')).toBe("Impossible d'ouvrir le clavier : {message}");
  });
});
