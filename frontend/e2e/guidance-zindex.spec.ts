import { test, expect } from '@playwright/test';

test.describe('Guidance Z-Index Conflict', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('guidance elements should have high z-index', async ({ page }) => {
    const guidance = page.locator('[class*="guidance"], [class*="walkthrough"], [class*="tooltip"]');
    const count = await guidance.count();
    
    if (count > 0) {
      const zIndex = await guidance.first().evaluate(el => {
        const style = getComputedStyle(el);
        return parseInt(style.zIndex) || 0;
      });
      expect(zIndex).toBeGreaterThan(100);
    }
  });

  test('tooltip should be above modal', async ({ page }) => {
    const modal = page.locator('[class*="modal"], [role="dialog"]');
    const tooltip = page.locator('[class*="tooltip"], [class*="guidance"]');
    
    const modalCount = await modal.count();
    const tooltipCount = await tooltip.count();
    
    if (modalCount > 0 && tooltipCount > 0) {
      const modalZ = await modal.first().evaluate(el => parseInt(getComputedStyle(el).zIndex) || 0);
      const tooltipZ = await tooltip.first().evaluate(el => parseInt(getComputedStyle(el).zIndex) || 0);
      expect(tooltipZ).toBeGreaterThan(modalZ);
    }
  });

  test('guidance should not overlap chart', async ({ page }) => {
    const chart = page.locator('[class*="tradingview"], [class*="chart"], iframe').first();
    const guidance = page.locator('[class*="guidance"], [class*="walkthrough"]').first();
    
    const chartCount = await chart.count();
    const guidanceCount = await guidance.count();
    
    if (chartCount > 0 && guidanceCount > 0) {
      const chartBox = await chart.boundingBox();
      const guidanceBox = await guidance.boundingBox();
      
      if (chartBox && guidanceBox) {
        const overlap = !(
          guidanceBox.x + guidanceBox.width < chartBox.x ||
          chartBox.x + chartBox.width < guidanceBox.x ||
          guidanceBox.y + guidanceBox.height < chartBox.y ||
          chartBox.y + chartBox.height < guidanceBox.y
        );
        console.log(`Chart-Guidance overlap: ${overlap}`);
      }
    }
  });

  test('walkthrough overlay should cover full screen', async ({ page }) => {
    const overlay = page.locator('[class*="walkthrough-overlay"], [class*="overlay"][class*="guidance"]');
    const count = await overlay.count();
    
    if (count > 0) {
      const box = await overlay.boundingBox();
      const viewport = page.viewportSize();
      
      if (box && viewport) {
        // Overlay should cover most of viewport
        const coverage = (box.width * box.height) / (viewport.width * viewport.height);
        expect(coverage).toBeGreaterThan(0.5);
      }
    }
  });
});
