import { expect, test } from '@playwright/test';

const led = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-key="${id}"] .key__led`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

test('« Couche affichée » montre les couleurs de la couche sélectionnée', async ({ page }) => {
  await expect(page.getByRole('radio', { name: 'Couche affichée' })).toHaveAttribute('aria-checked', 'true');
  // BASE : touches transparentes, l'effet réel du clavier passe à travers
  await expect(led(page, '5,0')).toHaveAttribute('data-led', 'on');
  await page.getByRole('tab', { name: '2 · FPS' }).click();
  await expect(led(page, '5,0')).toHaveCSS('fill', 'rgb(0, 0, 255)');
  await expect(led(page, '5,5')).toHaveCSS('fill', 'rgb(255, 255, 0)');
  await expect(led(page, '0,0')).toHaveAttribute('data-led', 'off');
  // la couche active du clavier (BASE) est signalée sur son onglet
  await expect(page.getByRole('tab', { name: '0 · BASE' })).toHaveClass(/tab--keyboard/);
});

test('« Clavier en direct » montre la couche active du clavier, pas celle du site', async ({ page }) => {
  await page.getByRole('radio', { name: 'Clavier en direct' }).click();
  await page.getByRole('tab', { name: '2 · FPS' }).click();
  await expect(led(page, '5,0')).toHaveAttribute('data-led', 'on');
  await expect(led(page, '5,0')).not.toHaveCSS('fill', 'rgb(0, 0, 255)');
  await expect(page.locator('#led-status')).toHaveText('Aperçu en direct des LED.');
});

test("« Masqué » retire l'éclairage, et le choix est gardé d'une visite à l'autre", async ({ page }) => {
  await page.getByRole('radio', { name: 'Masqué' }).click();
  await expect(led(page, '5,0')).toHaveAttribute('data-led', '');
  await expect(page.locator('#led-status')).toHaveText('Aperçu des LED désactivé.');

  await page.reload();
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await expect(page.getByRole('radio', { name: 'Masqué' })).toHaveAttribute('aria-checked', 'true');
  await expect(led(page, '5,0')).toHaveAttribute('data-led', '');
});
