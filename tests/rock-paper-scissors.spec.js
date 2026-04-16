const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Rock Paper Scissors game
 *
 * Tests the full game loop including:
 * - Console errors on load
 * - Three choice buttons visible
 * - Score display showing Wins/Played
 * - Animation (~1s) and result display
 * - Wins counter increments on player victory only
 * - Played counter increments every round
 * - Play Again resets UI but keeps counter
 * - Restart zeroes counter to 0/0
 * - Back link navigation
 * - window.rockPaperScissorsGame testability API
 */
test.describe('Rock Paper Scissors Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the rock-paper-scissors game
    await page.goto('http://localhost:3000/rock-paper-scissors/index.html');

    // Reset game to known state
    await page.evaluate(() => window.rockPaperScissorsGame.reset());
  });

  test('no console errors on load', async ({ page }) => {
    // Clear any errors from navigation
    page.consoleErrors = [];

    // Reload to test fresh load
    await page.goto('http://localhost:3000/rock-paper-scissors/index.html');

    // Wait for choice buttons to appear
    await page.waitForSelector('.choice-buttons');

    // Check no console errors
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('page loads with three choice buttons visible', async ({ page }) => {
    const choiceButtons = page.locator('.choice-buttons');
    await expect(choiceButtons).toBeVisible();

    // Should have exactly 3 buttons
    const buttons = choiceButtons.locator('.choice-btn');
    await expect(buttons).toHaveCount(3);

    // Verify button text (emojis)
    const rockBtn = buttons.nth(0);
    const paperBtn = buttons.nth(1);
    const scissorsBtn = buttons.nth(2);
    await expect(rockBtn).toHaveText('🪨');
    await expect(paperBtn).toHaveText('📄');
    await expect(scissorsBtn).toHaveText('✂️');
  });

  test('score shows Wins: 0 | Played: 0', async ({ page }) => {
    const scoreDisplay = page.locator('#score-display');
    await expect(scoreDisplay).toBeVisible();

    const wins = page.locator('#wins');
    const played = page.locator('#played');

    await expect(wins).toHaveText('0');
    await expect(played).toHaveText('0');

    // Check full text format
    const scoreText = await scoreDisplay.textContent();
    expect(scoreText).toContain('Wins:');
    expect(scoreText).toContain('Played:');
  });

  test('clicking Rock triggers ~1s animation then shows result', async ({ page }) => {
    const rockBtn = page.locator('.choice-btn').first();

    // Click Rock
    await rockBtn.click();

    // Animation scene should appear
    const animationScene = page.locator('#animation-scene');
    await expect(animationScene).toBeVisible();

    // Wait for animation to complete (wait for play-again button or result)
    // The animation runs ~1s (100ms interval × 10 iterations = 1s, plus showResult call)
    const playAgainBtn = page.locator('#play-again-btn');
    await playAgainBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Result should be visible
    const resultDisplay = page.locator('#result-container');
    await expect(resultDisplay).toBeVisible();
  });

  test('wins counter increments on player victory only (not ties)', async ({ page }) => {
    // Force computer to choose scissors (rock beats scissors)
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('scissors'));

    // Click Rock to win
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Wins should be 1
    expect(await page.locator('#wins').textContent()).toBe('1');

    // Reset for next test
    await page.evaluate(() => window.rockPaperScissorsGame.reset());

    // Force computer to choose rock (tie)
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('rock'));

    // Click Rock (tie)
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Wins should still be 0
    expect(await page.locator('#wins').textContent()).toBe('0');
  });

  test('played counter increments every round', async ({ page }) => {
    // First round
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    expect(await page.locator('#played').textContent()).toBe('1');

    // Play again
    await page.locator('#play-again-btn').click();
    await expect(page.locator('.choice-buttons')).toBeVisible();

    // Second round
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    expect(await page.locator('#played').textContent()).toBe('2');
  });

  test('play again resets UI but keeps counter', async ({ page }) => {
    // Play a round
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Score should have incremented
    const wins = await page.locator('#wins').textContent();
    const played = await page.locator('#played').textContent();

    // Click Play Again
    await page.locator('#play-again-btn').click();

    // Choice buttons should be visible again
    await expect(page.locator('.choice-buttons')).toBeVisible();

    // Result display should be hidden
    await expect(page.locator('#result-container')).toBeHidden();

    // Score counters should be preserved
    expect(await page.locator('#wins').textContent()).toBe(wins);
    expect(await page.locator('#played').textContent()).toBe(played);
  });

  test('restart zeroes counter to 0/0', async ({ page }) => {
    // Play first round
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Click Play Again to reset UI for second round
    await page.locator('#play-again-btn').click();
    await expect(page.locator('.choice-buttons')).toBeVisible();

    // Play second round
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Counters should be > 0
    expect(parseInt(await page.locator('#played').textContent())).toBeGreaterThan(0);

    // Click Restart
    await page.locator('.restart-btn').click();

    // Counters should be zero
    await expect(page.locator('#wins')).toHaveText('0');
    await expect(page.locator('#played')).toHaveText('0');

    // Choice buttons should be visible (game reset to picking phase)
    await expect(page.locator('.choice-buttons')).toBeVisible();
  });

  test('back link navigates to ../index.html', async ({ page }) => {
    const backLink = page.locator('.back-link');

    // Verify back link exists and has correct href
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute('href');
    expect(href).toBe('../index.html');

    // Click the back link and wait for navigation
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      backLink.click()
    ]);

    // Should end up at the root index page
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('window.rockPaperScissorsGame.getScore() returns { wins, played }', async ({ page }) => {
    // Play a round to increment score
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Get score via API
    const score = await page.evaluate(() => window.rockPaperScissorsGame.getScore());

    // Verify structure
    expect(score).toHaveProperty('wins');
    expect(score).toHaveProperty('played');
    expect(typeof score.wins).toBe('number');
    expect(typeof score.played).toBe('number');

    // played should be >= 1
    expect(score.played).toBeGreaterThanOrEqual(1);
  });

  test('window.rockPaperScissorsGame.setResult forces deterministic outcome', async ({ page }) => {
    // Force computer to choose paper (player will lose with rock)
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('paper'));

    // Click Rock
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Result should show loss (paper beats rock)
    const resultText = await page.locator('#result-message').textContent();
    expect(resultText.toLowerCase()).toContain('lose');

    // Wins should still be 0 (player lost)
    expect(await page.locator('#wins').textContent()).toBe('0');
  });

  test('window.rockPaperScissorsGame.setTarget is alias for setResult', async ({ page }) => {
    // Use setTarget (alias) to force outcome
    await page.evaluate(() => window.rockPaperScissorsGame.setTarget('scissors'));

    // Click Rock (should win against scissors)
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // Should have won
    expect(await page.locator('#wins').textContent()).toBe('1');

    // getTarget should return the forced value
    const target = await page.evaluate(() => window.rockPaperScissorsGame.getTarget());
    expect(target).toBe('scissors');
  });

  test('result text shows correct win/lose/tie message', async ({ page }) => {
    // Test win scenario: rock beats scissors
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('scissors'));
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    const winText = await page.locator('#result-message').textContent();
    expect(winText.toLowerCase()).toContain('win');
    expect(winText.toLowerCase()).toContain('rock');

    // Reset and test lose scenario
    await page.evaluate(() => window.rockPaperScissorsGame.reset());
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('paper'));
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    const loseText = await page.locator('#result-message').textContent();
    expect(loseText.toLowerCase()).toContain('lose');

    // Reset and test tie scenario
    await page.evaluate(() => window.rockPaperScissorsGame.reset());
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('rock'));
    await page.locator('.choice-btn').first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    const tieText = await page.locator('#result-message').textContent();
    expect(tieText.toLowerCase()).toContain('tie');
  });

  test('all three choice buttons work correctly', async ({ page }) => {
    // Test each button individually
    const buttons = page.locator('.choice-btn');

    // Rock button
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('scissors'));
    await buttons.first().click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });
    await page.locator('#play-again-btn').click();

    // Paper button
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('rock'));
    await buttons.nth(1).click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });
    await page.locator('#play-again-btn').click();

    // Scissors button
    await page.evaluate(() => window.rockPaperScissorsGame.setResult('paper'));
    await buttons.nth(2).click();
    await page.waitForSelector('#play-again-btn', { state: 'visible', timeout: 5000 });

    // All three rounds played
    expect(await page.locator('#played').textContent()).toBe('3');
  });
});