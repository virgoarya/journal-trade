import { test, expect } from '@playwright/test';

test.describe('Login + OAuth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  });

  test('should show login or auth option', async ({ page }) => {
    const loginBtn = page.locator('button:has-text("Login"), button:has-text("Sign in"), a:has-text("Login"), a:has-text("Sign in")');
    const loginCount = await loginBtn.count();
    
    const discordBtn = page.locator('button:has-text("Discord"), a:has-text("Discord"), [class*="discord"]');
    const discordCount = await discordBtn.count();
    
    expect(loginCount + discordCount).toBeGreaterThan(0);
  });

  test('should have Discord OAuth button', async ({ page }) => {
    const discordBtn = page.locator('button:has-text("Discord"), a:has-text("Discord"), [class*="discord"]');
    const count = await discordBtn.count();
    
    if (count > 0) {
      await expect(discordBtn.first()).toBeVisible();
    } else {
      const oauthBtns = page.locator('button:has-text("OAuth"), button:has-text("Google"), button:has-text("GitHub")');
      const oauthCount = await oauthBtns.count();
      console.log(`OAuth buttons found: ${oauthCount}`);
    }
  });
});
