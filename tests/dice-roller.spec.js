const { test, expect } = require('@playwright/test');

test.describe('Dice Roller Game', () => {
  test.beforeEach(async ({ page }) => {
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') page.consoleErrors.push(msg.text());
    });
    await page.goto('http://localhost:3000/dice-roller/index.html');
    await page.evaluate(() => window.game.reset());
  });

  test('no console errors on load', async ({ page }) => {
    page.consoleErrors = [];
    await page.goto('http://localhost:3000/dice-roller/index.html');
    await page.waitForSelector('#bet-form');
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('betting with $10 starting cash', async ({ page }) => {
    expect(await page.locator('#cash-value').textContent()).toBe('10');
  });

  test('betting form accepts valid bet', async ({ page }) => {
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await expect(page.locator('#sum-selection')).toBeVisible();
    await expect(page.locator('#bet-form')).toBeHidden();
  });

  test('sum selection triggers dice roll', async ({ page }) => {
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('.sum-btn').nth(5).click();
    await expect(page.locator('#dice-container')).toBeVisible();
    expect(await page.evaluate(() => window.game.getPhase())).toBe('result');
  });

  test('winning roll pays correct amount based on PAYOUT_ODDS', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(5).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('cash-change');
      return !el || el.textContent === '';
    }, { timeout: 3000 });
    expect(await page.locator('#cash-value').textContent()).toBe('60');
    const rt = await page.locator('#roll-result').textContent();
    expect(rt).toContain('7');
    expect(rt).toContain('+$50');
  });

  test('losing roll deducts bet amount', async ({ page }) => {
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.setCash(20));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(0).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('cash-change');
      return !el || el.textContent === '';
    }, { timeout: 3000 });
    expect(await page.locator('#cash-value').textContent()).toBe('15');
    const rt = await page.locator('#roll-result').textContent();
    expect(rt).toContain('-$5');
  });

  test('winning at $1000 triggers win screen and confetti', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(990));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(5).click();
    // 3s tumble + 0.5s settle + 4s fallback + 1.5s delay = ~9s max
    await page.locator('#win-screen').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#win-screen')).toBeVisible();
    await expect(page.locator('#confetti-canvas')).toBeVisible();
    await expect(page.locator('.win-screen__title')).toHaveText('You Win!');
  });

  test('losing at $0 triggers lose screen', async ({ page }) => {
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(0).click();
    // 3s tumble + 0.5s settle + 4s fallback + 1.5s delay = ~9s max
    await page.locator('#lose-screen').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#lose-screen')).toBeVisible();
    await expect(page.locator('#dice-container')).toBeVisible();
    await expect(page.locator('.lose-screen__title')).toContainText('lost');
  });

  test('play again resets for another round and restores cash to $10', async ({ page }) => {
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(0).click();
    await page.locator('#lose-screen').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#lose-screen')).toBeVisible();
    expect(await page.locator('#cash-value').textContent()).toBe('0');
    await page.locator('#lose-screen button').click();
    await expect(page.locator('#bet-form')).toBeVisible();
    await expect(page.locator('#lose-screen')).toBeHidden();
    expect(await page.locator('#cash-value').textContent()).toBe('10');
  });

  test('restart button resets game with $10 cash', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(500));
    await page.locator('.restart-btn').click();
    expect(await page.locator('#cash-value').textContent()).toBe('10');
    await expect(page.locator('#bet-form')).toBeVisible();
  });

  test('bet exceeding cash shows error without triggering roll', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10));
    await page.locator('#bet-input').fill('999');
    await page.locator('#bet-btn').click();
    await expect(page.locator('#bet-input')).toHaveClass(/input--error/, { timeout: 3000 });
    await expect(page.locator('#sum-selection')).toBeHidden();
    expect(await page.locator('#cash-value').textContent()).toBe('10');
  });

  test('window.game.setCash(n) works', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(100));
    expect(await page.evaluate(() => window.game.getCash())).toBe(100);
    expect(await page.locator('#cash-value').textContent()).toBe('100');
  });

  test('window.game.setForcedDice forces deterministic outcome', async ({ page }) => {
    await page.evaluate(() => window.game.setForcedDice(6, 6));
    await page.evaluate(() => window.game.setCash(10));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(10).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('cash-change');
      return !el || el.textContent === '';
    }, { timeout: 3000 });
    expect(await page.locator('#cash-value').textContent()).toBe('360');
    const rt = await page.locator('#roll-result').textContent();
    expect(rt).toContain('12');
    expect(rt).toContain('+$350');
  });

  test('window.game.getPhase() returns correct phase transitions', async ({ page }) => {
    expect(await page.evaluate(() => window.game.getPhase())).toBe('betting');
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    expect(await page.evaluate(() => window.game.getPhase())).toBe('rolling');
    await page.evaluate(() => window.game.setForcedDice(2, 3));
    await page.locator('.sum-btn').nth(0).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    expect(await page.evaluate(() => window.game.getPhase())).toBe('result');
  });

  test('bet all button sets bet to current cash', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(50));
    await page.locator('.bet-all-btn').click();
    expect(await page.locator('#bet-input').inputValue()).toBe('50');
  });

  test('rollDice function is exposed via window.game API', async ({ page }) => {
    expect(await page.evaluate(() => typeof window.game.rollDice === 'function')).toBe(true);
    expect(await page.evaluate(() => typeof window.game.setForcedDice === 'function')).toBe(true);
  });

  test('payout odds are correct per PAYOUT_ODDS map', async ({ page }) => {
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('2');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(5).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('cash-change');
      return !el || el.textContent === '';
    }, { timeout: 3000 });
    expect(await page.locator('#cash-value').textContent()).toBe('20');
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(6, 6));
    await page.locator('#bet-input').fill('1');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(10).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('cash-change');
      return !el || el.textContent === '';
    }, { timeout: 3000 });
    expect(await page.locator('#cash-value').textContent()).toBe('45');
  });

  test('back link navigates to ../index.html', async ({ page }) => {
    await expect(page.locator('.back-link')).toBeVisible();
    expect(await page.locator('.back-link').getAttribute('href')).toBe('../index.html');
    await Promise.all([page.waitForNavigation({ timeout: 10000 }), page.locator('.back-link').click()]);
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('console logs contain payout info after roll', async ({ page }) => {
    const logs = [];
    page.on('console', msg => { if (msg.type() !== 'error') logs.push(msg.text()); });
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(5).click();
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });
    expect(logs.some(t => t.includes('[Dice Roller]'))).toBe(true);
  });

  test('sum buttons are hidden during animation -- negative test Q7', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(5).click();
    await expect(page.locator('#sum-selection')).toBeHidden();
    await page.evaluate(() => {
      window.game.handleSumSelection(7);
      window.game.handleSumSelection(2);
    });
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 10000 });
    const rt = await page.locator('#roll-result').textContent();
    expect(rt).toContain('7');
    expect(rt).not.toContain('Sum: 2');
  });

  test('phase guard blocks handleSumSelection during animation', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(100));
    await page.evaluate(() => window.game.setForcedDice(1, 1));
    await page.locator('#bet-input').fill('10');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(0).click();
    expect(await page.evaluate(() => window.game.getPhase())).toBe('result');
    await page.evaluate(() => window.game.handleSumSelection(7));
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 10000 });
    const rt = await page.locator('#roll-result').textContent();
    expect(rt).toContain('Sum: 2');
    expect(rt).not.toContain('Sum: 7');
  });

  // ====== BETTING UX POLISH TESTS (T02) ======

  test('payout odds visible on sum buttons after bet', async ({ page }) => {
    // Each sum button should show its payout odds in the format "sum (odds:1)"
    const expectedOdds = {
      2: '35', 3: '17', 4: '11', 5: '8', 6: '6.2', 7: '5',
      8: '6.2', 9: '8', 10: '11', 11: '17', 12: '35'
    };
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    const buttons = await page.locator('.sum-btn').all();
    expect(buttons.length).toBe(11);
    for (let i = 0; i < buttons.length; i++) {
      const sum = i + 2;
      const text = await buttons[i].textContent();
      expect(text, `Sum ${sum} button should contain odds ${expectedOdds[sum]}:1`).toContain(expectedOdds[sum] + ':1');
    }
  });

  test('payout reference section visible during betting, hidden during roll', async ({ page }) => {
    // During betting phase, payout table should be visible
    await expect(page.locator('#payout-table')).toBeVisible();

    // After placing bet, payout table should be hidden
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await expect(page.locator('#payout-table')).toBeHidden();
  });

  test('bet error message shown for bet exceeding cash', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10));
    await page.locator('#bet-input').fill('100');
    await page.locator('#bet-btn').click();
    await expect(page.locator('#bet-error')).toBeVisible();
    const errorText = await page.locator('#bet-error').textContent();
    expect(errorText).toContain('exceeds');
    expect(errorText).toContain('10');
    // Bet form should still be visible (no navigation)
    await expect(page.locator('#bet-form')).toBeVisible();
    // Sum selection should not appear
    await expect(page.locator('#sum-selection')).toBeHidden();
  });

  test('bet error message shown for bet <= 0', async ({ page }) => {
    // HTML5 min=1 blocks form submission for 0 and negative numbers.
    // Test the JS validation directly by triggering handleBet with an invalid value.
    await page.evaluate(() => {
      document.getElementById('bet-input').value = '-1';
      // Simulate the JS validation path (bypass HTML5 constraint validation)
      window.game.handleBet({ preventDefault: () => {} });
    });
    await expect(page.locator('#bet-error')).toBeVisible();
    const errorText = await page.locator('#bet-error').textContent();
    expect(errorText.toLowerCase()).toContain('valid');
    expect(errorText.toLowerCase()).toContain('greater than');
    // Bet form should still be visible
    await expect(page.locator('#bet-form')).toBeVisible();
    await expect(page.locator('#sum-selection')).toBeHidden();
  });

  test('bet error message cleared after valid bet', async ({ page }) => {
    // First trigger an error
    await page.evaluate(() => window.game.setCash(10));
    await page.locator('#bet-input').fill('999');
    await page.locator('#bet-btn').click();
    await expect(page.locator('#bet-error')).toBeVisible();

    // Now enter a valid bet
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await expect(page.locator('#bet-error')).toBeHidden();
  });

  test('selected sum display shows payout odds', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(3, 4));
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await expect(page.locator('#selected-sum-display')).toBeVisible();

    // Click sum 7 button (index 5)
    await page.locator('.sum-btn').nth(5).click();
    // After clicking, the display should update to show the chosen sum with odds
    await page.waitForTimeout(200);
    const displayText = await page.locator('#selected-sum-display').textContent();
    expect(displayText).toContain('7');
    expect(displayText).toContain('5:1');
  });

  // ====== NEW 3D DICE TESTS (T03) ======

  test('roll animation applies .rolling class during tumble', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10));
    await page.evaluate(() => window.game.setForcedDice(1, 1));
    await page.locator('#bet-input').fill('5');
    await page.locator('#bet-btn').click();
    await page.waitForSelector('#sum-selection');
    await page.locator('.sum-btn').nth(0).click();

    // Poll until we see .rolling on both dice (avoids race if check is slightly late)
    let die1Rolling = false;
    let die2Rolling = false;
    for (let i = 0; i < 30; i++) {
      die1Rolling = await page.evaluate(() => document.getElementById('die-1').classList.contains('rolling'));
      die2Rolling = await page.evaluate(() => document.getElementById('die-2').classList.contains('rolling'));
      if (die1Rolling && die2Rolling) break;
      await page.waitForTimeout(100);
    }
    expect(die1Rolling, 'die-1 should have .rolling class immediately after roll').toBe(true);
    expect(die2Rolling, 'die-2 should have .rolling class immediately after roll').toBe(true);

    // Wait for animation to complete -- rolling class should be gone
    await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 10000 });
    expect(await page.evaluate(() => document.getElementById('die-1').classList.contains('rolling'))).toBe(false);
    expect(await page.evaluate(() => document.getElementById('die-2').classList.contains('rolling'))).toBe(false);
  });

  test('dice show correct .show-N face class after roll', async ({ page }) => {
    // Test multiple die values to cover each face
    const cases = [[1, 1], [1, 2], [3, 4], [5, 6]];
    for (const pair of cases) {
      const d1 = pair[0];
      const d2 = pair[1];
      // Pass d1/d2 as args so browser context can access them
      await page.evaluate(([v1, v2]) => {
        window.game.reset();
        window.game.setCash(10);
        window.game.setForcedDice(v1, v2);
      }, [d1, d2]);
      await page.locator('#bet-input').fill('5');
      await page.locator('#bet-btn').click();
      await page.waitForSelector('#sum-selection');
      // Select a sum that is not the rolled sum to avoid triggering a win (and extra delays)
      const losingSum = d1 + d2 === 2 ? 3 : 2;
      await page.locator('.sum-btn').nth(losingSum - 2).click();
      await page.locator('#play-again-btn').waitFor({ state: 'visible', timeout: 8000 });

      // Verify .show-N class matches forced values
      const die1Class = await page.evaluate(() => document.getElementById('die-1').className);
      const die2Class = await page.evaluate(() => document.getElementById('die-2').className);
      expect(die1Class, 'die-1 should show face ' + d1).toContain('show-' + d1);
      expect(die2Class, 'die-2 should show face ' + d2).toContain('show-' + d2);
    }
  });
});
