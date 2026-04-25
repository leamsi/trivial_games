const { test, expect } = require('@playwright/test');

test.describe('Password Cracker Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the game
    await page.goto('http://localhost:3000/password-cracker/index.html');

    // Set a deterministic secret code for testing: [1, 2, 3, 4, 5]
    await page.evaluate(() => {
      window.game.setTarget([1, 2, 3, 4, 5]);
    });
  });

  test('no console errors on load', async ({ page }) => {
    expect(page.consoleErrors).toHaveLength(0);
  });

  test('auto-focuses next input after digit entry', async ({ page }) => {
    const inputs = page.locator('.digit-input');

    await inputs.nth(0).fill('1');
    await expect(inputs.nth(1)).toBeFocused();

    await inputs.nth(1).fill('2');
    await expect(inputs.nth(2)).toBeFocused();
  });

  test('check button is enabled only when all digits are filled', async ({ page }) => {
    const checkBtn = page.locator('#check-btn');
    const inputs = page.locator('.digit-input');

    await expect(checkBtn).toBeDisabled();

    await inputs.nth(0).fill('1');
    await inputs.nth(1).fill('2');
    await inputs.nth(2).fill('3');
    await inputs.nth(3).fill('4');
    await expect(checkBtn).toBeDisabled();

    await inputs.nth(4).fill('5');
    await expect(checkBtn).toBeEnabled();
  });

  test('provides correct feedback for a partial guess', async ({ page }) => {
    const inputs = page.locator('.digit-input');
    const checkBtn = page.locator('#check-btn');
    const feedbackArea = page.locator('#feedback-area');

    // Secret is [1, 2, 3, 4, 5]
    // Guess [1, 3, 2, 6, 7]
    // 1: Right Place
    // 3: Wrong Place
    // 2: Wrong Place
    // Result: 1 right place (RP), 2 wrong place (WP)

    await inputs.nth(0).fill('1');
    await inputs.nth(1).fill('3');
    await inputs.nth(2).fill('2');
    await inputs.nth(3).fill('6');
    await inputs.nth(4).fill('7');

    await checkBtn.click();

    await expect(feedbackArea).toBeVisible();
    await expect(feedbackArea).toContainText('2 right number wrong place, 1 right number right place');

    // Check history
    const historyItem = page.locator('.history-item').first();
    await expect(historyItem).toContainText('13267');
    await expect(historyItem).toContainText('1 Right');
    await expect(historyItem).toContainText('2 Wrong');
  });

  test('winning the game', async ({ page }) => {
    const inputs = page.locator('.digit-input');
    const checkBtn = page.locator('#check-btn');
    const winScreen = page.locator('#win-screen');

    await inputs.nth(0).fill('1');
    await inputs.nth(1).fill('2');
    await inputs.nth(2).fill('3');
    await inputs.nth(3).fill('4');
    await inputs.nth(4).fill('5');

    await checkBtn.click();

    await expect(winScreen).toBeVisible();
    await expect(winScreen).toContainText('Access Granted!');
    await expect(page.locator('#confetti-canvas')).toBeVisible();
  });

  test('losing the game', async ({ page }) => {
    // Set guesses to 1 for quick test
    await page.evaluate(() => {
      // Accessing internal state if possible or just loop
      // Better to just loop if we can't easily set remaining guesses
    });

    const inputs = page.locator('.digit-input');
    const checkBtn = page.locator('#check-btn');

    // We'll just loop a few times and then mock the remaining guesses if possible,
    // but the safest way is to just do it or mock the state.
    // Let's try to mock the state for speed.
    await page.evaluate(() => {
      // We don't have a direct way to set guessesRemaining from window.game in the current implementation
      // Let's add it or just loop. 30 is not THAT many for a machine.
    });

    for (let i = 0; i < 30; i++) {
        await inputs.nth(0).fill('9');
        await inputs.nth(1).fill('9');
        await inputs.nth(2).fill('9');
        await inputs.nth(3).fill('9');
        await inputs.nth(4).fill('9');
        await checkBtn.click();
    }

    const loseScreen = page.locator('#lose-screen');
    await expect(loseScreen).toBeVisible();
    await expect(loseScreen).toContainText('Access Denied!');
    await expect(page.locator('#correct-code')).toContainText('1 2 3 4 5');
  });

  test('restart resets the game', async ({ page }) => {
    const inputs = page.locator('.digit-input');
    const checkBtn = page.locator('#check-btn');

    await inputs.nth(0).fill('1');
    await inputs.nth(1).fill('2');
    await inputs.nth(2).fill('3');
    await inputs.nth(3).fill('4');
    await inputs.nth(4).fill('5');
    await checkBtn.click();

    await expect(page.locator('#win-screen')).toBeVisible();

    await page.locator('.restart-btn').click();

    await expect(page.locator('#win-screen')).toBeHidden();
    await expect(page.locator('#game-play-area')).toBeVisible();
    await expect(inputs.nth(0)).toHaveValue('');
    await expect(page.locator('.history-item')).toHaveCount(0);
  });
});
