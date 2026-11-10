import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

test('capturer au clavier : la combinaison tapée est affectée à la touche choisie', async ({ page }) => {
  const details = page.locator('#key-details');
  await page.locator('[data-key="5,0"]').click();
  await page.getByRole('button', { name: 'Capturer au clavier' }).click();
  await expect(page.locator('#key-capture')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Shift+Digit1');
  await expect(details).toContainText('LSFT(KC_1)');
  // en capture, Ctrl+Z est une combinaison à affecter, pas Annuler
  await page.keyboard.press('Control+KeyZ');
  await expect(details).toContainText('LCTL(KC_Z)');

  // la capture reste armée d'une touche à l'autre
  await page.locator('[data-key="5,1"]').click();
  await expect(page.locator('#key-capture')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('KeyQ');
  await expect(details).toContainText('KC_Q');
  // un modificateur seul, appuyé puis relâché
  await page.keyboard.press('Shift');
  await expect(details).toContainText('KC_LSHIFT');
  // Ctrl + Maj seuls, appuyés puis relâchés : une touche qui tient Ctrl et Maj
  await page.keyboard.press('Control+Shift');
  await expect(details).toContainText('LCTL(KC_LSHIFT)');

  await page.keyboard.press('Escape');
  await expect(page.locator('#key-capture')).toHaveAttribute('aria-pressed', 'false');
  // hors capture, Ctrl+Z annule de nouveau
  await page.keyboard.press('Control+KeyZ');
  await expect(details).toContainText('KC_LSHIFT');
});
