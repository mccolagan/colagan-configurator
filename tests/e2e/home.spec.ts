import { expect, test } from '@playwright/test';

test('la page d’accueil s’affiche et détecte WebHID', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Colagan Configurator' })).toBeVisible();
  // Chromium sur localhost : contexte sécurisé, WebHID disponible
  await expect(page.locator('#support')).toHaveAttribute('data-level', 'ok');
  await expect(page.getByRole('button', { name: 'Connecter le clavier' })).toBeEnabled();
});

test('le thème choisi est appliqué et mémorisé', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Thème').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
