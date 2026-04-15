const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Coin Flip game
 *
 * Tests the full game loop including:
 * - Console errors on load
 * - Betting flow (bet, Bet All)
 * - Heads/tails selection and cash updates
 * - Win state at $1000 with confetti
 * - Lose state at $0
 * - Play Again and Restart functionality
 * - window.coinFlipGame testability API
 */
test.describe('Coin Flip Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the coin-flip game
    await page.goto('http://localhost:3000/coin-flip/index.html');

    // Reset game to known state
    await page.evaluate(() => window.coinFlipGame.restart());
  });

  test('no console errors on load', async ({ page }) => {
    // Clear any errors from navigation
    page.consoleErrors = [];

    // Reload to test fresh load
    await page.goto('http://localhost:3000/coin-flip/index.html');

    // Wait for bet form to appear
    await page.waitForSelector('#bet-form');

    // Check no console errors
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('betting with $10 starting cash', async ({ page }) => {
    // Verify initial cash display shows $10
    const cashValue = await page.locator('#cash-value').textContent();
    expect(cashValue).toBe('10');
  });

  test('betting form accepts valid bet', async ({ page }) => {
    // Fill in a valid bet
    const betInput = page.locator('#bet-input');
    await betInput.fill('5');

    // Submit the bet form
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Wait for coin buttons to appear (bet was accepted)
    const coinButtons = page.locator('#coin-buttons');
    await expect(coinButtons).toBeVisible();

    // Betting form should be hidden
    await expect(page.locator('#bet-form')).toBeHidden();
  });

  test('heads selection triggers flip and updates cash on win', async ({ page }) => {
    // Set cash to known value
    await page.evaluate(() => window.coinFlipGame.setCash(20));

    // Set forced flip result to 'heads' to ensure player wins
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));

    // Place a bet
    const betInput = page.locator('#bet-input');
    await betInput.fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Wait for coin buttons
    await page.waitForSelector('#coin-buttons');

    // Click Heads — player chose heads and wins (result is heads)
    await page.locator('.coin-btn').first().click();

    // Wait for cash animation to complete (appears after coin animation ends)
    // The cash-change element shows +$5 during animation, then disappears when done
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cash-change');
        return el && (el.textContent.includes('+$5') || parseInt(document.getElementById('cash-value').textContent) === 25);
      },
      { timeout: 3000 }
    );
    // Wait for animation to fully complete (cash-change disappears)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cash-change');
        return !el || el.textContent === '';
      },
      { timeout: 3000 }
    );

    // Cash should now be $25 (won: 20 + 5)
    const cashValue = await page.locator('#cash-value').textContent();
    expect(cashValue).toBe('25');

    // Flip result should be visible
    await expect(page.locator('#flip-result')).toBeVisible();
  });

  test('tails selection triggers flip and updates cash on loss', async ({ page }) => {
    // Set cash to known value
    await page.evaluate(() => window.coinFlipGame.setCash(20));

    // Set forced flip result to 'heads' — player will choose tails and lose
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));

    // Place a bet
    const betInput = page.locator('#bet-input');
    await betInput.fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Wait for coin buttons
    await page.waitForSelector('#coin-buttons');

    // Click Tails — player chose tails and loses (result is heads)
    await page.locator('.coin-btn').last().click();

    // Wait for cash animation to complete (appears after coin animation ends)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cash-change');
        return el && (el.textContent.includes('-$5') || parseInt(document.getElementById('cash-value').textContent) === 15);
      },
      { timeout: 3000 }
    );
    // Wait for animation to fully complete (cash-change disappears)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cash-change');
        return !el || el.textContent === '';
      },
      { timeout: 3000 }
    );

    // Cash should now be $15 (lost: 20 - 5)
    const cashValue = await page.locator('#cash-value').textContent();
    expect(cashValue).toBe('15');

    // Flip result should be visible
    await expect(page.locator('#flip-result')).toBeVisible();
  });

  test('bet all button sets bet to current cash', async ({ page }) => {
    // Set cash to known value
    await page.evaluate(() => window.coinFlipGame.setCash(50));

    // Click Bet All button
    await page.locator('.bet-all-btn').click();

    // Verify input value matches cash
    const betInput = page.locator('#bet-input');
    const inputValue = await betInput.inputValue();
    expect(inputValue).toBe('50');
  });

  test('bet button submits the bet form', async ({ page }) => {
    // Fill in a bet amount
    const betInput = page.locator('#bet-input');
    await betInput.fill('5');

    // Click the Bet button
    await page.locator('#bet-btn').click();

    // Wait for coin buttons to appear (bet was accepted)
    const coinButtons = page.locator('#coin-buttons');
    await expect(coinButtons).toBeVisible();

    // Betting form should be hidden
    await expect(page.locator('#bet-form')).toBeHidden();
  });

  test('result shows win amount on victory', async ({ page }) => {
    // Set forced result to 'heads' and player chooses heads → win
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));
    await page.evaluate(() => window.coinFlipGame.setCash(20));

    // Place bet of $5
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());
    await page.waitForSelector('#coin-buttons');

    // Choose heads to win
    await page.locator('.coin-btn').first().click();

    // Wait for result text to appear
    const flipResult = page.locator('#flip-result');
    await flipResult.waitFor({ state: 'visible', timeout: 5000 });

    // Result should show win amount
    const resultText = await flipResult.textContent();
    expect(resultText).toContain("It's HEADS!");
    expect(resultText).toContain('You WON +$5');
  });

  test('result shows loss amount on defeat', async ({ page }) => {
    // Set forced result to 'heads' and player chooses tails → lose
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));
    await page.evaluate(() => window.coinFlipGame.setCash(20));

    // Place bet of $5
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());
    await page.waitForSelector('#coin-buttons');

    // Choose tails to lose
    await page.locator('.coin-btn').last().click();

    // Wait for result text to appear
    const flipResult = page.locator('#flip-result');
    await flipResult.waitFor({ state: 'visible', timeout: 5000 });

    // Result should show loss amount
    const resultText = await flipResult.textContent();
    expect(resultText).toContain("It's HEADS!");
    expect(resultText).toContain('You LOST -$5');
  });

  test('winning at $1000 triggers win screen and confetti', async ({ page }) => {
    // Set cash to $990
    await page.evaluate(() => window.coinFlipGame.setCash(990));

    // Set forced result to 'heads' and player chooses heads → win
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));

    // Place bet of $10
    const betInput = page.locator('#bet-input');
    await betInput.fill('10');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Wait for coin buttons
    await page.waitForSelector('#coin-buttons');

    // Click Heads to win
    await page.locator('.coin-buttons .coin-btn').first().click();

    // Win screen appears after animation (1.5s) + 500ms delay
    const winScreen = page.locator('#win-screen');
    await winScreen.waitFor({ state: 'visible', timeout: 5000 });

    // Win screen should be visible
    await expect(winScreen).toBeVisible();

    // Confetti canvas should be visible
    const confettiCanvas = page.locator('#confetti-canvas');
    await expect(confettiCanvas).toBeVisible();

    // Win screen title should say "You Win!"
    const winTitle = page.locator('.win-screen__title');
    await expect(winTitle).toHaveText('You Win!');
  });

  test('losing at $0 triggers lose screen', async ({ page }) => {
    // Set cash to $10
    await page.evaluate(() => window.coinFlipGame.setCash(10));

    // Set forced result to 'heads' — player will choose tails and lose
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));

    // Place bet of $10
    const betInput = page.locator('#bet-input');
    await betInput.fill('10');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Wait for coin buttons
    await page.waitForSelector('#coin-buttons');

    // Click Tails — player loses all cash
    await page.locator('.coin-buttons .coin-btn').last().click();

    // Lose screen appears after animation (1.5s) + 500ms delay
    const loseScreen = page.locator('#lose-screen');
    await loseScreen.waitFor({ state: 'visible', timeout: 5000 });

    // Lose screen should be visible
    await expect(loseScreen).toBeVisible();

    // Should contain "You lost" text
    const loseTitle = page.locator('.lose-screen__title');
    await expect(loseTitle).toContainText('lost');
  });

  test('play again resets for another round and restores cash to starting $10', async ({ page }) => {
    // Go through a full losing round to trigger lose screen
    // Start with cash $10, bet $10, lose → cash goes to $0, lose screen shows
    await page.evaluate(() => window.coinFlipGame.setCash(10));

    // Set forced result to 'heads' — player will choose tails and lose
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));

    // Place bet of $10
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Wait for coin buttons to be visible (bet was accepted)
    await page.waitForFunction(() => {
      const el = document.getElementById('coin-buttons');
      return el && el.style.display !== 'none';
    }, { timeout: 3000 });

    // Choose Tails — player loses (result is heads)
    await page.locator('.coin-btn').last().click();

    // Lose screen appears after animation (1.5s) + 500ms delay (cash goes to 0, <= 0 triggers lose)
    const loseScreen = page.locator('#lose-screen');
    await loseScreen.waitFor({ state: 'visible', timeout: 5000 });
    await expect(loseScreen).toBeVisible();

    // Cash should be $0
    expect(await page.locator('#cash-value').textContent()).toBe('0');

    // Click Play Again
    await page.locator('#lose-screen button').click();

    // Betting form should be visible again
    await expect(page.locator('#bet-form')).toBeVisible();

    // Lose screen should be hidden
    await expect(page.locator('#lose-screen')).toBeHidden();

    // Bet input should be cleared
    const inputValue = await page.locator('#bet-input').inputValue();
    expect(inputValue).toBe('');

    // Cash should be reset to starting $10 (playAgain resets cash on game over)
    expect(await page.locator('#cash-value').textContent()).toBe('10');
  });

  test('restart button resets game with $10 cash', async ({ page }) => {
    // Set cash to something other than 10
    await page.evaluate(() => window.coinFlipGame.setCash(500));

    // Click restart
    await page.locator('.restart-btn').click();

    // Cash should reset to $10
    expect(await page.locator('#cash-value').textContent()).toBe('10');

    // Betting form should be visible
    await expect(page.locator('#bet-form')).toBeVisible();
  });

  test('invalid bet shows error without consuming flip', async ({ page }) => {
    // Set cash to $10
    await page.evaluate(() => window.coinFlipGame.setCash(10));

    // Try to place a bet exceeding cash ($999)
    const betInput = page.locator('#bet-input');
    await betInput.fill('999');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());

    // Should have error class (JS validation: bet > cash)
    await expect(betInput).toHaveClass(/input--error/, { timeout: 3000 });

    // Coin buttons should NOT appear (flip not triggered)
    await expect(page.locator('#coin-buttons')).toBeHidden();

    // Cash should still be $10
    expect(await page.locator('#cash-value').textContent()).toBe('10');
  });

  test('window.coinFlipGame.setCash(n) works', async ({ page }) => {
    // Call setCash directly
    await page.evaluate(() => window.coinFlipGame.setCash(100));

    // Verify getCash returns 100
    const cash = await page.evaluate(() => window.coinFlipGame.getCash());
    expect(cash).toBe(100);

    // Verify the display updated
    expect(await page.locator('#cash-value').textContent()).toBe('100');
  });

  test('window.coinFlipGame.setFlipResult forces deterministic outcome', async ({ page }) => {
    // Set forced result to 'tails'
    await page.evaluate(() => window.coinFlipGame.setFlipResult('tails'));

    // Set cash to 20, bet 5
    await page.evaluate(() => window.coinFlipGame.setCash(20));
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());
    await page.waitForSelector('#coin-buttons');

    // Player chooses heads — should LOSE because result is tails
    await page.locator('.coin-btn').first().click();

    // Wait for animation to complete (play-again button appears after animation)
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 5000 });

    // Wait for cash animation to complete
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cash-change');
        return !el || el.textContent === '';
      },
      { timeout: 3000 }
    );

    // Cash should be 15 (lost)
    expect(await page.locator('#cash-value').textContent()).toBe('15');

    // Result display should show "It's TAILS!" (result was tails)
    const resultText = await page.locator('#flip-result').textContent();
    expect(resultText).toContain('TAILS');
  });

  test('coin element present in DOM before any flip', async ({ page }) => {
    // The coin-scene element should exist in DOM from page load (hidden initially)
    const coinScene = page.locator('#coin-scene');
    await expect(coinScene).toBeAttached();

    // Should be hidden before any flip
    await expect(coinScene).toBeHidden();

    // The coin element inside should also be present
    const coin = page.locator('#coin');
    await expect(coin).toBeAttached();

    // Should not have animation classes yet
    const coinState = await page.evaluate(() => window.coinFlipGame.getCoinState());
    expect(coinState).not.toContain('flipping');
    expect(coinState).not.toContain('show-heads');
    expect(coinState).not.toContain('show-tails');
  });

  test('coin has .flipping class during flip and lands on correct face', async ({ page }) => {
    // Set forced result to 'heads'
    await page.evaluate(() => window.coinFlipGame.setFlipResult('heads'));
    await page.evaluate(() => window.coinFlipGame.setCash(20));

    // Place bet and choose heads
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());
    await page.waitForSelector('#coin-buttons');

    // Click Heads
    await page.locator('.coin-btn').first().click();

    // Wait for .flipping class to appear (animation started)
    await page.waitForFunction(
      () => document.getElementById('coin').classList.contains('flipping'),
      { timeout: 1000 }
    );

    // Verify .flipping is present
    const flippingState = await page.evaluate(() => window.coinFlipGame.getCoinState());
    expect(flippingState).toContain('flipping');

    // Wait for animation to complete and result class to appear
    await page.waitForFunction(
      () => {
        const coin = document.getElementById('coin');
        return coin.classList.contains('show-heads') || coin.classList.contains('show-tails');
      },
      { timeout: 5000 }
    );

    // Should land on show-heads (forced result was heads)
    const finalState = await page.evaluate(() => window.coinFlipGame.getCoinState());
    expect(finalState).toContain('show-heads');
    expect(finalState).not.toContain('flipping');
  });

  test('result text and play-again button visible after animation, cash preserved on mid-round play again', async ({ page }) => {
    // Set forced result to 'tails'
    await page.evaluate(() => window.coinFlipGame.setFlipResult('tails'));
    await page.evaluate(() => window.coinFlipGame.setCash(20));

    // Place bet and choose heads (will lose since result is tails)
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-form').evaluate(form => form.requestSubmit());
    await page.waitForSelector('#coin-buttons');

    // Player chooses heads — will lose
    await page.locator('.coin-btn').first().click();

    // Wait for play-again button to appear (after animation)
    const playAgainBtn = page.locator('#play-again-btn');
    await playAgainBtn.waitFor({ state: 'visible', timeout: 5000 });
    await expect(playAgainBtn).toBeVisible();

    // Result text should say "It's TAILS!" (result was tails)
    const flipResult = page.locator('#flip-result');
    await expect(flipResult).toBeVisible();
    const resultText = await flipResult.textContent();
    expect(resultText).toContain("It's TAILS!");

    // Coin should show show-tails
    const coinState = await page.evaluate(() => window.coinFlipGame.getCoinState());
    expect(coinState).toContain('show-tails');

    // Wait for cash animation to finish (600ms) before checking
    await page.waitForFunction(() => {
      const el = document.getElementById('cash-change');
      return el && el.textContent === '';
    }, { timeout: 3000 });

    // Cash should be $15 after losing $5 bet
    expect(await page.locator('#cash-value').textContent()).toBe('15');

    // Click Play Again (mid-round, before lose/win screen) — cash should be preserved
    await playAgainBtn.click();
    await expect(page.locator('#bet-form')).toBeVisible();
    expect(await page.locator('#cash-value').textContent()).toBe('15');
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

    // Should end up at the root index page (serve . maps / → index.html)
    await expect(page).toHaveURL('http://localhost:3000/');
  });
});
