import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

test('le guide place un exemple dans Keycode avancé, puis Appliquer l’affecte à la touche choisie', async ({
  page,
}) => {
  await page.locator('[data-key="5,0"]').click();
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Guide' });
  await expect(guide).toBeVisible();
  await guide.getByText('Appui et maintien', { exact: true }).click();
  await expect(guide.locator('#guide-hold')).toHaveAttribute('open', '');
  await guide.getByRole('button', { name: 'Placer LT(1, KC_SPC) dans Keycode avancé' }).click();
  await expect(guide).toBeHidden();
  await expect(page.getByPlaceholder(/Keycode avancé/)).toHaveValue('LT(1, KC_SPC)');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.locator('#key-details')).toContainText('LT1(KC_SPACE)');
});

test('le lien de l’onglet Touches ouvre la rubrique Appui et maintien ; Échap ferme le guide', async ({
  page,
}) => {
  await page.locator('#guide-hold-link').click();
  const guide = page.getByRole('dialog', { name: 'Guide' });
  await expect(guide.locator('#guide-hold')).toHaveAttribute('open', '');
  await expect(guide.locator('#guide-tapDance')).not.toHaveAttribute('open', '');
  await guide.getByRole('button', { name: 'Fermer' }).focus();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
});

test('les rubriques du guide sont dans la palette de commandes', async ({ page }) => {
  await page.locator('body').press('Control+k');
  await page.keyboard.type('Tap-dance');
  await page.getByRole('option', { name: /Tap-dance\s*Guide/ }).click();
  await expect(page.getByRole('dialog', { name: 'Guide' }).locator('#guide-tapDance')).toHaveAttribute(
    'open',
    '',
  );
});
