import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  // l'effet global se règle en mode Couleurs, sur la couche 0
  await page.getByRole('radio', { name: 'Couleurs' }).click();
});

test('affiche le mode lu et les effets supportés en français', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Éclairage RGB' })).toHaveCount(0);
  const effect = page.locator('#rgb-effect');
  await expect(effect).toHaveValue('14');
  await expect(effect.locator('option:checked')).toHaveText('Arc-en-ciel gauche-droite');
  // OFF + 23 effets du firmware
  await expect(effect.locator('option')).toHaveCount(24);
  await expect(page.locator('#rgb-value')).toHaveAttribute('max', '64');
  await expect(page.locator('#rgb-state')).toContainText('enregistré');
  await expect(page.locator('#rgb-save')).toBeDisabled();
});

test('un changement marque « non enregistré », Enregistrer puis Rétablir', async ({ page }) => {
  await page.locator('#rgb-effect').selectOption({ label: 'Couleur unie' });
  await expect(page.locator('#rgb-state')).toContainText('non enregistré');
  await page.locator('#rgb-save').click();
  await expect(page.locator('#rgb-state')).toContainText('Éclairage enregistré');

  await page.locator('#rgb-hue').fill('170');
  await expect(page.locator('#rgb-state')).toContainText('non enregistré');
  await page.locator('#rgb-revert').click();
  await expect(page.locator('#rgb-hue')).toHaveValue('0');
  await expect(page.locator('#rgb-effect')).toHaveValue('2');
  await expect(page.locator('#rgb-save')).toBeDisabled();
});
