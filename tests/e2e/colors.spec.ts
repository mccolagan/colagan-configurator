import { expect, test } from '@playwright/test';

const led = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-key="${id}"] .key__led`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await page.getByRole('tab', { name: 'Lumière' }).click();
  await page.getByRole('tab', { name: '2 · FPS' }).click();
});

test('peindre une touche, annuler, rétablir, pipette', async ({ page }) => {
  await expect(page.locator('#key-details')).toBeHidden();
  await expect(led(page, '5,0')).toHaveCSS('fill', 'rgb(0, 0, 255)');
  await page.getByRole('radio', { name: 'Blanc' }).click();
  await page.locator('[data-key="5,0"]').click();
  await expect(led(page, '5,0')).toHaveCSS('fill', 'rgb(255, 255, 255)');
  await expect(page.locator('#edit-status')).toContainText('1 touche(s) peinte(s) sur FPS');

  await page.locator('#undo').click();
  await expect(led(page, '5,0')).toHaveCSS('fill', 'rgb(0, 0, 255)');
  await page.locator('#redo').click();
  await expect(led(page, '5,0')).toHaveCSS('fill', 'rgb(255, 255, 255)');

  // Alt+clic : le pinceau reprend le jaune de Tab
  await page.locator('[data-key="5,5"]').click({ modifiers: ['Alt'] });
  await expect(page.locator('#brush-current')).toHaveText('#FFFF00');
});

test('glisser peint plusieurs touches en une seule action annulable', async ({ page }) => {
  await page.getByRole('radio', { name: 'Vert' }).click();
  const from = await page.locator('[data-key="6,0"]').boundingBox();
  const to = await page.locator('[data-key="6,3"]').boundingBox();
  if (!from || !to) throw new Error('touches introuvables');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  for (const id of ['6,0', '6,1', '6,2', '6,3'])
    await expect(led(page, id)).toHaveCSS('fill', 'rgb(0, 255, 0)');
  await expect(page.locator('#edit-status')).toContainText('4 touche(s)');
  await page.locator('#undo').click();
  await expect(led(page, '6,0')).toHaveCSS('fill', 'rgb(255, 0, 0)');
  await expect(led(page, '6,1')).toHaveCSS('fill', 'rgb(255, 255, 0)');
});

test('remplir la couche puis tout rendre transparent, en une action annulable chacun', async ({ page }) => {
  await page.getByRole('radio', { name: 'Rouge' }).click();
  await page.locator('#colors-fill').click();
  await expect(page.locator('#edit-status')).toContainText('58 touche(s) peinte(s) sur FPS');
  await expect(led(page, '9,4')).toHaveCSS('fill', 'rgb(255, 0, 0)');
  await page.locator('#colors-clear').click();
  await expect(led(page, '9,4')).toHaveAttribute('data-led', /on|effect/);
  await page.locator('#undo').click();
  await expect(led(page, '9,4')).toHaveCSS('fill', 'rgb(255, 0, 0)');
});

test('effet propre à une couche, puis retour aux valeurs par défaut', async ({ page }) => {
  await expect(page.getByText("Cette couche utilise l'effet global")).toBeVisible();
  await page.locator('#effect-own').check();
  await expect(page.locator('#rgb-effect')).toBeVisible();
  await expect(page.locator('#rgb-save')).toBeHidden();
  await expect(page.locator('#rgb-state')).toHaveText('Enregistré dans le clavier à chaque réglage.');

  await page.getByRole('radio', { name: 'Éteinte' }).click();
  await page.locator('[data-key="5,0"]').click();
  await expect(led(page, '5,0')).toHaveAttribute('data-led', 'off');
  await page.locator('#colors-reset').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(led(page, '5,0')).toHaveCSS('fill', 'rgb(0, 0, 255)');
  await expect(page.locator('#effect-own')).not.toBeChecked();
});
