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

  test('should display settings for the selected game mode', async ({ page }) => {
    // Precision Challenge is selected by default, so its settings should be visible.
    await expect(page.locator('#precision-challenge-settings')).toBeVisible();
    await expect(page.locator('#whack-a-mole-settings')).toBeHidden();

    // Select Whack-a-Mole and check that its settings are visible.
    await page.selectOption('#game-mode-select', 'whack_a_mole');
    await expect(page.locator('#whack-a-mole-settings')).toBeVisible();
    await expect(page.locator('#precision-challenge-settings')).toBeHidden();
  });

  test('should navigate to the game page when start button is clicked', async ({ page }) => {
    await page.click('#start-game-button');
    await expect(page).toHaveURL(/game\.html/);
  });
});
