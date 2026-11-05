import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const fixture = readFileSync('tests/fixtures/colagan-v2-default.vil', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.getByRole('button', { name: 'Essayer sans clavier (démo)' }).click();
  await page.getByRole('tab', { name: 'Sauvegarde' }).click();
});

test('l’export produit le même fichier que Vial', async ({ page }) => {
  const download = page.waitForEvent('download');
  await page.locator('#vil-export').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^colagan-v2_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}\.vil$/);
  const path = await file.path();
  expect(readFileSync(path, 'utf8')).toBe(fixture);
});

test('l’import montre les différences, prend un instantané et peut être restauré', async ({ page }) => {
  const modified = fixture.replace('[["KC_5", "KC_4"', '[["KC_5", "KC_Q"');
  await page.locator('#vil-import').setInputFiles({
    name: 'modifie.vil',
    mimeType: 'application/json',
    buffer: Buffer.from(modified),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('1 touche(s) modifiée(s)');
  await dialog.getByRole('button', { name: 'Écrire dans le clavier' }).click();
  await expect(page.locator('#backup-status')).toContainText('Import terminé : 1 écriture(s)');
  await expect(page.locator('#snapshots li')).toHaveCount(1);
  await expect(page.locator('#snapshots')).toContainText('Avant import de « modifie.vil »');

  await page.getByRole('tab', { name: 'Touches' }).click();
  await expect(page.locator('[data-key="0,1"]')).toContainText('A');

  await page.getByRole('tab', { name: 'Sauvegarde' }).click();
  await page.locator('#snapshots').getByRole('button', { name: 'Restaurer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Écrire dans le clavier' }).click();
  await expect(page.locator('#backup-status')).toContainText('Import terminé');
  await page.getByRole('tab', { name: 'Touches' }).click();
  await expect(page.locator('[data-key="0,1"]')).toHaveAttribute('aria-label', 'KC_4 (0,1)');
});

test('un fichier identique au clavier n’écrit rien', async ({ page }) => {
  await page.locator('#vil-import').setInputFiles({
    name: 'identique.vil',
    mimeType: 'application/json',
    buffer: Buffer.from(fixture),
  });
  await expect(page.locator('#backup-status')).toContainText('rien à écrire');
});

test('un fichier invalide est refusé sans écriture', async ({ page }) => {
  await page.locator('#vil-import').setInputFiles({
    name: 'faux.vil',
    mimeType: 'application/json',
    buffer: Buffer.from('{"pas": "un vil"}'),
  });
  await expect(page.locator('#backup-status')).toContainText('impossible');
});
