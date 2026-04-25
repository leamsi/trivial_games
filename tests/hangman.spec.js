const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Hangman game
 */
test.describe('Hangman Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the game
    await page.goto('http://localhost:3000/hangman/index.html');

    // Set a deterministic target word for testing
    await page.evaluate(() => {
      window.game.setTarget('ARCADE');
    });
  });

  test('no console errors on load', async ({ page }) => {
    expect(page.consoleErrors).toHaveLength(0);
  });

  test('correct guess reveals letter', async ({ page }) => {
    // Guess 'A'
    await page.evaluate(() => window.game.guess('A'));

    // Check word display
    const slots = page.locator('.letter-slot');
    await expect(slots.nth(0)).toHaveText('A');

    // Check alphabet key
    const key = page.locator('#key-A');
    await expect(key).toHaveClass(/alphabet-key--correct/);
  });

  test('wrong guess updates gallows', async ({ page }) => {
    // Guess 'Z' (not in ARCADE)
    await page.evaluate(() => window.game.guess('Z'));

    // Check alphabet key
    const key = page.locator('#key-Z');
    await expect(key).toHaveClass(/alphabet-key--wrong/);

    // Check gallows part visibility
    const rope = page.locator('#man-rope');
    await expect(rope).toHaveCSS('display', 'block');
  });

  test('winning the game', async ({ page }) => {
    const word = 'ARCADE';
    for (const letter of word) {
      await page.evaluate((l) => window.game.guess(l), letter);
    }

    // Check win screen
    const winScreen = page.locator('#win-screen');
    await expect(winScreen).toBeVisible();
    await expect(page.locator('.win-screen__title')).toHaveText('YOU SURVIVED!');
  });

  test('losing the game', async ({ page }) => {
    const wrongs = ['Z', 'X', 'Y', 'W', 'V', 'U', 'T'];
    for (const letter of wrongs) {
      await page.evaluate((l) => window.game.guess(l), letter);
    }

    // Check lose screen
    const loseScreen = page.locator('#lose-screen');
    await expect(loseScreen).toBeVisible();
    await expect(page.locator('#lose-reveal')).toHaveText('ARCADE');

    // Check all man parts visible
    const lastPart = page.locator('#man-leg-r');
    await expect(lastPart).toBeVisible();
  });

  test('restart resets the game', async ({ page }) => {
    // Make a guess
    await page.evaluate(() => window.game.guess('Z'));
    await expect(page.locator('#man-rope')).toHaveCSS('display', 'block');

    // Click restart
    await page.locator('.restart-btn').click();

    // Check gallows reset
    await expect(page.locator('#man-rope')).toHaveCSS('display', 'none');

    // Check word slots (should be new random word, but we'll set it again for stability)
    await page.evaluate(() => window.game.setTarget('RETRO'));
    const slots = page.locator('.letter-slot');
    await expect(slots).toHaveCount(5);
  });

  test('input box submission works', async ({ page }) => {
    const input = page.locator('#letter-input');
    await input.focus();
    await input.type('A');

    // Check if guess was processed
    const key = page.locator('#key-A');
    await expect(key).toHaveClass(/alphabet-key--correct/);
  });
});
