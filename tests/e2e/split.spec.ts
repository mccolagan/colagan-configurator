import { expect, test } from '@playwright/test';

interface DemoHook {
  __demo?: { setRemote(connected: boolean): void };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

test('la moitié maître est affichée, une moitié débranchée est signalée puis retrouvée', async ({ page }) => {
  await page.locator('#pill').click();
  await expect(page.locator('#device-halves')).toHaveText('Droite branchée au PC (maître) · gauche reliée');
  await page.locator('#device-close').click();
  await expect(page.locator('#pill')).toHaveAttribute('data-state', 'demo');

  await page.evaluate(() => {
    (window as DemoHook).__demo?.setRemote(false);
  });
  await expect(page.locator('#pill')).toHaveAttribute('data-state', 'partial');
  await expect(page.locator('#pill')).toContainText('droite seule');
  await expect(page.locator('#toasts')).toContainText('Moitié gauche injoignable');
  await page.locator('#pill').click();
  await expect(page.locator('#device-halves')).toHaveText(
    'Droite branchée au PC (maître) · gauche non reliée',
  );
  await page.locator('#device-close').click();

  await page.evaluate(() => {
    (window as DemoHook).__demo?.setRemote(true);
  });
  await expect(page.locator('#toasts')).toContainText('Moitié gauche reliée');
  await expect(page.locator('#pill')).toHaveAttribute('data-state', 'demo');
});

test('survoler une couche de la barre montre sa fiche (description, accès, numéro)', async ({ page }) => {
  const card = page.locator('.lcard');
  await expect(card).toHaveClass(/out/);
  await page.getByRole('tab', { name: '2 · FPS' }).hover();
  await expect(card).not.toHaveClass(/out/);
  await expect(card).toContainText('FPS');
  await expect(card).toContainText('Couche 2');
  await expect(card).toContainText('Warzone');
  await expect(card).toContainText('Accès');
  await page.mouse.move(10, 300);
  await expect(card).toHaveClass(/out/);
});
