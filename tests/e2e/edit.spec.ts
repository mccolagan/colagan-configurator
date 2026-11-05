import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await expect(page.locator('[data-key]')).toHaveCount(58);
});

const key = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-key="${id}"]`);

test('étiquettes AZERTY par défaut, bascule QWERTY mémorisée', async ({ page }) => {
  // [5,0] = KC_6 : « - » en AZERTY, 6 en Shift, | en AltGr
  await expect(key(page, '5,0')).toContainText('-');
  await expect(key(page, '5,0').locator('.key__shift')).toHaveText('6');
  await expect(key(page, '5,0').locator('.key__altgr')).toHaveText('|');
  await page.locator('#labels').selectOption('qwerty');
  await expect(key(page, '5,0')).toContainText('^6');
  await page.reload();
  await expect(page.locator('#labels')).toHaveValue('qwerty');
});

test('affecter une touche, annuler puis rétablir', async ({ page }) => {
  await key(page, '5,0').click();
  await page.locator('[data-keycode="KC_Q"]').click();
  await expect(key(page, '5,0')).toContainText('A');
  await expect(page.locator('#key-details')).toContainText('KC_Q');
  await expect(page.locator('#edit-status')).toContainText('KC_Q');

  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('#key-details')).toContainText('KC_6');
  await expect(page.locator('#redo')).toBeEnabled();

  await page.locator('body').press('Control+Shift+Z');
  await expect(page.locator('#key-details')).toContainText('KC_Q');
  await page.locator('body').press('Control+z');
  await expect(page.locator('#key-details')).toContainText('KC_6');
});

test('recherche par caractère AZERTY', async ({ page }) => {
  await page.getByRole('searchbox').fill('ù');
  await expect(page.locator('.picker__grid [data-keycode]')).toHaveCount(1);
  await expect(page.locator('[data-keycode="KC_QUOTE"]')).toBeVisible();
});

test('saisie avancée et keycode masqué', async ({ page }) => {
  await key(page, '5,0').click();
  await page.getByPlaceholder(/Keycode avancé/).fill('LT(2, KC_SPC)');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.locator('#key-details')).toContainText('LT2(KC_SPACE)');

  await page.getByPlaceholder(/Keycode avancé/).fill('n’importe quoi');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.locator('.picker__message')).toContainText('illisible');

  await page.locator('[data-category="modifiers"]').click();
  await page.locator('[data-keycode="LSFT(kc)"]').click();
  await expect(page.locator('.picker__mask')).toBeVisible();
  await page.locator('[data-keycode="KC_1"]').click();
  await expect(page.locator('#key-details')).toContainText('LSFT(KC_1)');
  await expect(key(page, '5,0')).toContainText('1');
});

test('QK_BOOT demande confirmation et le firmware verrouillé le refuse', async ({ page }) => {
  await key(page, '5,0').click();
  await page.locator('[data-category="boot"]').click();
  await page.locator('[data-keycode="QK_BOOT"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('mode flash');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('#key-details')).toContainText('KC_6');

  await page.locator('[data-keycode="QK_BOOT"]').click();
  await page.getByRole('button', { name: 'Affecter quand même' }).click();
  await expect(page.locator('#edit-status')).toContainText('déverrouiller');
  await expect(page.locator('#key-details')).toContainText('KC_NO');
});
