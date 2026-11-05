import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

test("l'aperçu colore les touches en direct et suit le réglage RGB", async ({ page }) => {
  await expect(page.locator('#led-preview')).toBeChecked();
  await expect(page.locator('#led-status')).toHaveText('Aperçu en direct des LED.');
  const led = page.locator('[data-key="5,0"] .key__led');
  await expect(led).toHaveAttribute('data-led', 'on');

  await page.getByRole('tab', { name: 'Éclairage RGB' }).click();
  await expect(page.locator('#rgb-keyboard [data-preview-key]')).toHaveCount(58);
  await page.locator('#rgb-effect').selectOption({ label: 'Couleur unie' });
  // teinte 0, saturation 255 : rouge pur une fois ramené à pleine luminosité
  await expect(page.locator('#rgb-keyboard [data-preview-key="0,0"] .key__led')).toHaveCSS(
    'fill',
    'rgb(255, 0, 0)',
  );
  await page.locator('#rgb-effect').selectOption({ label: 'Éteint' });
  await expect(page.locator('#rgb-keyboard [data-preview-key="0,0"] .key__led')).toHaveAttribute(
    'data-led',
    'off',
  );
});

test("se désactive, et le choix est gardé d'une visite à l'autre", async ({ page }) => {
  await page.locator('#led-preview').uncheck();
  await expect(page.locator('[data-key="5,0"] .key__led')).toHaveAttribute('data-led', '');
  await expect(page.locator('#led-status')).toHaveText('Aperçu des LED désactivé.');

  await page.reload();
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await expect(page.locator('#led-preview')).not.toBeChecked();
  await expect(page.locator('[data-key="5,0"] .key__led')).toHaveAttribute('data-led', '');
});
