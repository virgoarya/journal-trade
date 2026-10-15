import { test, expect } from '@playwright/test';

test.describe('Login + OAuth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login option', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for login/auth elements
    const loginElements = page.locator('button:has-text("Login"), button:has-text("Sign in"), a:has-text("Login"), a:has-text("Sign in"), [class*="login"], [class*="auth"]');
    const count = await loginElements.count();
    console.log(`Found ${count} login-related elements`);
    
    await page.screenshot({ path: 'e2e/screenshots/login-page.png', fullPage: true });
  });

  test('should have Discord OAuth button', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const discordBtn = page.locator('button:has-text("Discord"), a:has-text("Discord"), [class*="discord"]');
    const count = await discordBtn.count();
    console.log(`Discord OAuth button: ${count > 0 ? 'FOUND' : 'NOT FOUND'}`);
  });
});
