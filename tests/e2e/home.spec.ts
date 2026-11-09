import { expect, test } from '@playwright/test';

test('la page d’accueil s’affiche et détecte WebHID', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Colagan Studio' })).toBeVisible();
  // Chromium sur localhost : contexte sécurisé, WebHID disponible
  await expect(page.locator('#support')).toHaveAttribute('data-level', 'ok');
  await expect(page.getByRole('button', { name: 'Connecter le clavier' })).toBeEnabled();
  await expect(page.locator('#pill')).toHaveAttribute('data-state', 'off');
});

test('le thème choisi est appliqué et mémorisé', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Affichage' }).click();
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('la palette de commandes s’ouvre avec Ctrl+K et lance une commande', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await expect(page.locator('[data-key]')).toHaveCount(58);
  await page.locator('body').press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Commandes' });
  await expect(palette).toBeVisible();
  await page.keyboard.type('fps');
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page.getByRole('tab', { name: '2 · FPS' })).toHaveAttribute('aria-selected', 'true');
});
