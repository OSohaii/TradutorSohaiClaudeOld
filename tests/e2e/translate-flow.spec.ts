import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E test skeleton for the translation pipeline flow.
 *
 * Requirements for full execution:
 * - The frontend dev server must be running (handled by playwright.config.ts webServer)
 * - The backend (FastAPI BFF) must be running for translation steps to complete
 *
 * Without a running backend, only the upload step can be verified. The
 * remaining assertions are documented as the intended flow.
 */
test.describe('Translation Flow', () => {
  test('upload page loads and shows uploader component', async ({ page }) => {
    await page.goto('/');

    // The uploader should be visible with one of its action labels
    const uploader = page.locator('text=/Carregar do Dispositivo|Selecionar Arquivos|Upload/i');
    await expect(uploader.first()).toBeVisible({ timeout: 10000 });
  });

  test('can upload a test image via file input', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    const fixturePath = path.resolve(__dirname, '../fixtures/test-image.png');
    await fileInput.setInputFiles(fixturePath);

    // After upload, the image should appear in the session (history sidebar or viewer)
    // The viewer container or image thumbnail should become visible
    // NOTE: Full pipeline verification requires a running backend
  });
});
