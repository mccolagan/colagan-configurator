import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

test('le mode démo lit le clavier simulé et dessine les 58 touches', async ({ page }) => {
  await expect(page.locator('#connection')).toHaveText('« Colagan V2 » : 8 couches, 58 touches.');
  await expect(page.getByText('Mode démo')).toBeVisible();
  await expect(page.locator('[data-key]')).toHaveCount(58);
  await expect(page.getByRole('tab', { name: '0 · BASE' })).toHaveAttribute('aria-selected', 'true');
  // pouce droit extérieur : touche personnalisée SEL x3, dessinée tournée
  const selector = page.locator('[data-key="9,4"]');
  await expect(selector).toContainText('SELx3');
  await expect(selector).toHaveAttribute('transform', /rotate\(45 /);
});

test('les onglets changent de couche', async ({ page }) => {
  await page.getByRole('tab', { name: '2 · FPS' }).click();
  await expect(page.getByRole('tab', { name: '2 · FPS' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-key="8,4"]')).toContainText('Enter');
  await expect(page.locator('[data-key="0,0"]')).toHaveClass(/key--transparent/);
});

test('une touche se sélectionne au clic et au clavier', async ({ page }) => {
  await page.locator('[data-key="9,4"]').click();
  await expect(page.locator('[data-key="9,4"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#key-details')).toContainText('USER00');
  await page.locator('[data-key="5,0"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#key-details')).toContainText('KC_6');
});
