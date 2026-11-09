import { expect, test, type Page } from '@playwright/test';

// Vue 3D par défaut (pas de préférence enregistrée), WebGL logiciel (SwiftShader) dans Chromium headless
test.use({
  storageState: { cookies: [], origins: [] },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
});

/** Point écran d'une touche en vue « Dessus » (vue quasi orthogonale, cadrée sur la disposition). */
async function keyPoint(page: Page, cx: number, cy: number): Promise<{ x: number; y: number }> {
  const canvas = page.locator('.keyboard-3d canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas absent');
  // encombrement du Colagan V2 (contour du PCB) : 18,26 × 6,1 unités, marge de 0,8, cadrage « Dessus » × 1,1
  const scale = Math.min(box.width / ((18.26 + 0.8) * 1.1), box.height / ((6.1 + 0.8) * 1.1));
  return {
    x: box.x + box.width / 2 + (cx - 18.26 / 2) * scale,
    y: box.y + box.height / 2 + (cy - 6.1 / 2 - 0.25) * scale,
  };
}

test('la vue 3D s’affiche par défaut, sans erreur, et suit les couches', async ({ page }) => {
  await expect(page.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.keyboard-3d canvas')).toBeVisible();
  await expect(page.locator('[data-key]')).toHaveCount(0);
  await page.getByRole('tab', { name: '2 · FPS' }).click();
  await page.getByRole('radio', { name: 'Clavier en direct' }).click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('un clic sur une touche 3D la sélectionne', async ({ page }) => {
  await page.getByRole('button', { name: 'Dessus' }).click();
  await page.waitForTimeout(1600);
  // [7,2] : moitié droite, 3e colonne, 3e rangée (centre 14,26 ; 2,5)
  const point = await keyPoint(page, 14.26, 2.5);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#key-details')).toContainText('7,2');
  expect(errors).toEqual([]);
});

test('« Plan » revient au dessin SVG, et le choix est mémorisé', async ({ page }) => {
  await page.getByRole('radio', { name: 'Plan' }).click();
  await expect(page.locator('[data-key]')).toHaveCount(58);
  await expect(page.locator('.keyboard-3d')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await expect(page.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-key]')).toHaveCount(58);
});

test('en mode Couleurs, un clic sur une touche 3D la peint', async ({ page }) => {
  await page.getByRole('radio', { name: 'Couleurs' }).click();
  await page.getByRole('button', { name: 'Dessus' }).click();
  await page.waitForTimeout(1600);
  const point = await keyPoint(page, 14.26, 2.5);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#edit-status')).toContainText('1 touche(s) peinte(s)');
  expect(errors).toEqual([]);
});
