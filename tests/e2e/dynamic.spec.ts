import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await page.getByRole('tab', { name: 'Macros & co' }).click();
  await expect(page.locator('#macro-list li')).toHaveCount(16);
});

test('tap-dance : choisir un keycode, annuler, rétablir', async ({ page }) => {
  await page.locator('[data-dyn="tapDance"]').click();
  const slot = page.locator('#tap-dance tr[data-index="0"] button').first();
  await expect(slot).toHaveText('—');
  await slot.click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-keycode="KC_A"]').click();
  await expect(slot).toHaveText('Q');
  await expect(page.locator('#edit-status')).toContainText('TD(0) enregistré');
  await expect(page.locator('#tap-dance tr[data-index="0"]')).toHaveClass(/is-used/);

  await page.locator('#undo').click();
  await expect(slot).toHaveText('—');
  await page.locator('#redo').click();
  await expect(slot).toHaveText('Q');

  const term = page.locator('#tap-dance tr[data-index="0"] input');
  await term.fill('150');
  await term.press('Enter');
  await expect(page.locator('#edit-status')).toContainText('TD(0) enregistré');
});

test('combo : deux touches donnent Échap', async ({ page }) => {
  await page.locator('[data-dyn="combos"]').click();
  const row = page.locator('#combos tr[data-index="0"]');
  await row.locator('button').nth(0).click();
  await page.getByRole('dialog').locator('[data-keycode="KC_J"]').click();
  await row.locator('button').nth(1).click();
  await page.getByRole('dialog').locator('[data-keycode="KC_K"]').click();
  await row.locator('button').nth(4).click();
  await page.getByRole('dialog').locator('[data-keycode="KC_ESCAPE"]').click();
  await expect(row.locator('button').nth(4)).toHaveText('Esc');
  await expect(row).toHaveClass(/is-used/);
});

test('macro : texte converti en frappes AZERTY puis enregistré après déverrouillage', async ({ page }) => {
  await page.getByRole('button', { name: '+ Texte' }).click();
  await page.locator('#macro-editor input[type="text"]').fill('gg wp');
  await expect(page.locator('#macro-editor')).toContainText('QWERTY');
  await page.getByRole('button', { name: 'Convertir en frappes AZERTY' }).click();
  await expect(page.locator('#macro-editor [data-action="tap"] .chip')).toHaveCount(6);
  await expect(page.locator('#macro-usage')).toContainText('/ 1903 octets');

  await page.locator('#macro-save').click();
  await expect(page.getByRole('dialog')).toContainText('Maintenez enfoncées');
  await expect(page.locator('#edit-status')).toContainText('Macro M0 enregistrée', { timeout: 10_000 });
  await expect(page.locator('[data-macro="0"]')).toContainText('tap KC_G KC_G KC_SPACE KC_Z KC_P');
  await expect(page.locator('#macro-save')).toBeDisabled();
});
