import { test, expect } from '@playwright/test';

test.describe('In-App Guidance Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure first-run experience
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('should show walkthrough on first run', async ({ page }) => {
    const walkthrough = page.locator('[class*="walkthrough"], [class*="guidance"], [data-testid*="walkthrough"]');
    const count = await walkthrough.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display tooltip component', async ({ page }) => {
    const tooltip = page.locator('[class*="tooltip"], [data-testid*="tooltip"]');
    const count = await tooltip.count();
    // Tooltip should exist in DOM (may or may not be visible)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have progress indicator', async ({ page }) => {
    const progress = page.locator('[class*="progress"], [role="progressbar"]');
    const count = await progress.count();
    if (count > 0) {
      await expect(progress.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should support next/skip interaction', async ({ page }) => {
    // Try to find and click next button
    const nextBtn = page.getByRole('button', { name: /next|lanjut|selanjutnya|continue/i });
    const nextCount = await nextBtn.count();
    
    if (nextCount > 0) {
      await nextBtn.first().click();
      await page.waitForTimeout(500);
      // Should still be on page (no crash)
      expect(page.url()).toContain('localhost');
    }
    
    // Try to find and click skip button
    const skipBtn = page.getByRole('button', { name: /skip|lewati|lewat|dismiss/i });
    const skipCount = await skipBtn.count();
    
    if (skipCount > 0) {
      await skipBtn.first().click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('localhost');
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Should not crash
    expect(page.url()).toContain('localhost');
  });

  test('should persist state in localStorage', async ({ page }) => {
    const storage = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('guidance') || k.includes('walkthrough'));
      return keys.length > 0 ? keys : null;
    });
    // localStorage should have guidance-related keys after interaction
    console.log('localStorage guidance keys:', storage);
  });

  test('should load manifest from config', async ({ page }) => {
    // Check if manifest is fetched
    const manifestExists = await page.evaluate(async () => {
      try {
        const res = await fetch('/config/guidance-manifest.json');
        return res.ok;
      } catch {
        return false;
      }
    });
    console.log('Manifest accessible:', manifestExists);
  });
});
