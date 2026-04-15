const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Pick-a-Number game
 * 
 * Tests the full game loop including:
 * - Console errors on load
 * - Higher/lower feedback
 * - Win state
 * - Restart functionality
 * - Guesses remaining updates
 */
test.describe('Pick-a-Number Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the game
    await page.goto('http://localhost:3000/pick-a-number/index.html');
    
    // Reset game to known state by calling restart
    await page.evaluate(() => window.game.restart());
    
    // Set a deterministic target number for testing (500)
    // This allows reliable testing of higher/lower feedback
    await page.evaluate(() => {
      window.game.setTarget(500);
    });
  });

  test('no console errors on load', async ({ page }) => {
    // Clear any errors from navigation
    page.consoleErrors = [];
    
    // Reload to test fresh load
    await page.goto('http://localhost:3000/pick-a-number/index.html');
    
    // Wait for game to initialize
    await page.waitForSelector('#guess-input');
    
    // Check no console errors
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('submitting a guess below the secret shows "higher"', async ({ page }) => {
    // Target is 500, so guess 100 should trigger "higher" feedback
    const guessInput = page.locator('#guess-input');
    await guessInput.fill('100');
    await page.locator('button[type="submit"]').click();
    
    // Wait for feedback to appear
    const feedbackArea = page.locator('#feedback-area');
    await expect(feedbackArea).toBeVisible();
    
    // Check feedback contains "higher"
    const feedbackText = await feedbackArea.textContent();
    expect(feedbackText.toLowerCase()).toContain('higher');
  });

  test('submitting a guess above the secret shows "lower"', async ({ page }) => {
    // Target is 500, so guess 900 should trigger "lower" feedback
    const guessInput = page.locator('#guess-input');
    await guessInput.fill('900');
    await page.locator('button[type="submit"]').click();
    
    // Wait for feedback to appear
    const feedbackArea = page.locator('#feedback-area');
    await expect(feedbackArea).toBeVisible();
    
    // Check feedback contains "lower"
    const feedbackText = await feedbackArea.textContent();
    expect(feedbackText.toLowerCase()).toContain('lower');
  });

  test('correct guess triggers the win state', async ({ page }) => {
    // Target is 500, so guess 500 should win
    const guessInput = page.locator('#guess-input');
    await guessInput.fill('500');
    await page.locator('button[type="submit"]').click();
    
    // Wait for win screen to appear
    const winScreen = page.locator('#win-screen');
    await expect(winScreen).toBeVisible();
    
    // Check win screen content
    const winTitle = page.locator('.win-screen__title');
    await expect(winTitle).toHaveText('You Got It!');
    
    // Check confetti canvas is displayed
    const confettiCanvas = page.locator('#confetti-canvas');
    await expect(confettiCanvas).toBeVisible();
    
    // Check input form is hidden
    const guessForm = page.locator('#guess-form');
    await expect(guessForm).toBeHidden();
  });

  test('restart resets the game', async ({ page }) => {
    // First, make a winning guess
    const guessInput = page.locator('#guess-input');
    await guessInput.fill('500');
    await page.locator('button[type="submit"]').click();
    
    // Win screen should be visible
    const winScreen = page.locator('#win-screen');
    await expect(winScreen).toBeVisible();
    
    // Click restart button
    await page.locator('.restart-btn').click();
    
    // Win screen should be hidden, form should be visible again
    await expect(winScreen).toBeHidden();
    await expect(page.locator('#guess-form')).toBeVisible();
    
    // Input should be cleared
    const inputValue = await guessInput.inputValue();
    expect(inputValue).toBe('');
  });

  test('expected-remaining-guesses updates after each guess', async ({ page }) => {
    // Set target to a known value using the proper API
    await page.evaluate(() => {
      window.game.setTarget(500);
      window.game.restart();
      window.game.setTarget(500);
    });
    
    // Get initial pips state
    const initialPips = await page.locator('.guesses-left__pip').count();
    expect(initialPips).toBe(10);
    
    // Make a guess (that will be wrong - triggering feedback)
    const guessInput = page.locator('#guess-input');
    await guessInput.fill('100');
    await page.locator('button[type="submit"]').click();
    
    // Wait for feedback
    await page.waitForSelector('#feedback-area:not([style*="display: none"])');
    
    // Check that one pip is now "used" (has the --used class)
    const usedPips = await page.locator('.guesses-left__pip--used').count();
    expect(usedPips).toBeGreaterThanOrEqual(1);
    
    // Verify remaining guesses text appears in feedback
    const feedbackText = await page.locator('#feedback-area').textContent();
    expect(feedbackText).toMatch(/9 guesses remaining/i);
  });

  test('game provides correct hints during gameplay', async ({ page }) => {
    // Set target to 500 for deterministic testing
    await page.evaluate(() => {
      window.game.setTarget(500);
    });
    
    // Make a guess too low
    await page.locator('#guess-input').fill('250');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#feedback-area')).toContainText(/higher/i);
    
    // Make a guess too high
    await page.locator('#guess-input').fill('750');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#feedback-area')).toContainText(/lower/i);
    
    // Make the correct guess
    await page.locator('#guess-input').fill('500');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#win-screen')).toBeVisible();
  });
});
