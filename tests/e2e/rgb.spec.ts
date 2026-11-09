import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  // l'effet global se règle dans l'onglet Lumière, sur la couche 0
  await page.getByRole('tab', { name: 'Lumière' }).click();
});

test('affiche le mode lu et les effets supportés en français', async ({ page }) => {
  const effects = page.locator('#rgb-effect');
  await expect(effects.locator('[aria-checked="true"]')).toHaveAttribute('data-effect', '14');
  await expect(effects.locator('[aria-checked="true"]')).toHaveText('Arc-en-ciel gauche-droite');
  // 23 effets du firmware (OFF passe par l'interrupteur « Éclairage allumé »)
  await expect(effects.getByRole('radio')).toHaveCount(23);
  await expect(page.locator('#rgb-value')).toHaveAttribute('max', '64');
  await expect(page.locator('#rgb-state')).toContainText('enregistré');
  await expect(page.locator('#rgb-save')).toBeDisabled();
  await expect(page.locator('#rgb-on')).toBeChecked();
});

test('un changement marque « non enregistré », Enregistrer puis Rétablir', async ({ page }) => {
  await page.getByRole('radio', { name: 'Couleur unie' }).click();
  await expect(page.locator('#rgb-state')).toContainText('non enregistré');
  await page.locator('#rgb-save').click();
  await expect(page.locator('#rgb-state')).toContainText('Éclairage enregistré');

  await page.locator('#rgb-hue').fill('170');
  await expect(page.locator('#rgb-state')).toContainText('non enregistré');
  await page.locator('#rgb-revert').click();
  await expect(page.locator('#rgb-hue')).toHaveValue('0');
  await expect(page.locator('[data-effect="2"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#rgb-save')).toBeDisabled();
});

test('l’interrupteur éteint l’éclairage puis rallume le dernier effet', async ({ page }) => {
  await page.locator('#rgb-on').uncheck();
  await expect(page.locator('#rgb-effect [aria-checked="true"]')).toHaveCount(0);
  await page.locator('#rgb-on').check();
  await expect(page.locator('[data-effect="14"]')).toHaveAttribute('aria-checked', 'true');
});
