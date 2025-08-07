const { test, expect } = require('@playwright/test');

test.describe('Lobby Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lobby');
  });

  test('should display the game lobby heading', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Game Lobby');
  });

  test('should display the game mode selector', async ({ page }) => {
    await expect(page.locator('#game-mode-select')).toBeVisible();
  });
});
