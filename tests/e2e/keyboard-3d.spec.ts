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

interface StudioHook {
  __studio?: { keyPoint(row: number, col: number): { x: number; y: number } | undefined };
}

interface DemoHook {
  __demo?: { setRemote(connected: boolean): void };
}

/** Position écran d'une touche 3D, donnée par la scène elle-même (caméra, panneaux et écartement compris). */
async function keyPoint(page: Page, row: number, col: number): Promise<{ x: number; y: number }> {
  await page.waitForFunction(() => Boolean((window as StudioHook).__studio));
  const point = await page.evaluate(([r, c]) => (window as StudioHook).__studio?.keyPoint(r, c), [
    row,
    col,
  ] as const);
  if (!point) throw new Error(`touche ${String(row)},${String(col)} hors champ`);
  return point;
}

test('la vue 3D s’affiche par défaut, passe par toutes les vues sans erreur et suit les couches', async ({
  page,
}) => {
  // cinq vues animées sous WebGL logiciel (SwiftShader) : bien plus lent qu'un vrai GPU
  test.slow();
  await expect(page.locator('#views').getByRole('button', { name: 'Produit' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.keyboard-3d canvas')).toBeVisible();
  await expect(page.locator('[data-key]')).toHaveCount(0);
  for (const view of ['Dessus', 'Éclaté', 'Rayons X', 'Couches', 'Produit']) {
    await page.locator('#views').getByRole('button', { name: view, exact: true }).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole('tab', { name: '2 · FPS' }).click();
  await page.getByRole('button', { name: 'Affichage' }).click();
  await page.getByRole('radio', { name: 'Clavier en direct' }).click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('un clic sur une touche 3D la sélectionne', async ({ page }) => {
  await page.locator('#views').getByRole('button', { name: 'Dessus' }).click();
  await page.waitForTimeout(1600);
  const point = await keyPoint(page, 7, 2);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#key-details')).toContainText('7,2');
  expect(errors).toEqual([]);
});

test('« Plan » revient au dessin SVG, et le choix est mémorisé', async ({ page }) => {
  await page.locator('#views').getByRole('button', { name: 'Plan' }).click();
  await expect(page.locator('[data-key]')).toHaveCount(58);
  await expect(page.locator('.keyboard-3d')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await expect(page.locator('#views').getByRole('button', { name: 'Plan' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-key]')).toHaveCount(58);
});

test('dans l’onglet Lumière, un clic sur une touche 3D la peint', async ({ page }) => {
  test.slow();
  await page.getByRole('tab', { name: 'Lumière' }).click();
  await page.locator('#views').getByRole('button', { name: 'Dessus' }).click();
  await page.waitForTimeout(1600);
  const point = await keyPoint(page, 7, 2);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#edit-status')).toContainText('1 touche(s) peinte(s)');
  expect(errors).toEqual([]);
});

test('onglet Essai : les touches cliquées écrivent dans la sortie, MO(1) ouvre FN tant qu’il est tenu', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Essai' }).click();
  await page.locator('#views').getByRole('button', { name: 'Dessus' }).click();
  await page.waitForTimeout(1600);
  const letter = await keyPoint(page, 6, 1);
  await page.mouse.click(letter.x, letter.y);
  await expect(page.locator('#try-output')).not.toHaveText('');
  const mo = await keyPoint(page, 4, 0);
  await page.mouse.move(mo.x, mo.y);
  await page.mouse.down();
  await expect(page.getByRole('tab', { name: '1 · FN' })).toHaveAttribute('aria-selected', 'true');
  await page.mouse.up();
  await expect(page.getByRole('tab', { name: '0 · BASE' })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('une frappe sur le clavier de l’ordinateur s’affiche dans le défilant', async ({ page }) => {
  await page.locator('body').press('KeyQ');
  // AZERTY : la touche KC_Q porte « A »
  await expect(page.locator('.ticker kbd').last()).toHaveText('A');
  expect(errors).toEqual([]);
});

test('la scène 3D signale la moitié maître ; une moitié débranchée disparaît puis revient', async ({
  page,
}) => {
  test.slow();
  // la scène se charge à la demande, puis l'état du split arrive avec l'aperçu LED
  await expect(page.locator('.k3d-htag', { hasText: 'Droite' })).toContainText('maître, branchée au PC', {
    timeout: 15_000,
  });
  const leftKeyShown = () => page.evaluate(() => Boolean((window as StudioHook).__studio?.keyPoint(1, 1)));
  expect(await leftKeyShown()).toBe(true);
  await page.evaluate(() => {
    (window as DemoHook).__demo?.setRemote(false);
  });
  // l'état est relu avec l'aperçu LED, ralenti ici par le rendu 3D logiciel
  await expect.poll(leftKeyShown, { timeout: 15_000 }).toBe(false);
  expect(await keyPoint(page, 7, 2)).toBeTruthy();
  await page.evaluate(() => {
    (window as DemoHook).__demo?.setRemote(true);
  });
  await expect.poll(leftKeyShown, { timeout: 15_000 }).toBe(true);
  expect(errors).toEqual([]);
});
