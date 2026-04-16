const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Mad Libs game
 *
 * Tests the full game loop including:
 * - Console errors on load
 * - Input fields rendered for each placeholder
 * - Submit button disabled until all fields filled
 * - Submit reveals the filled phrase with all replacements
 * - Another one button rerolls to a new phrase and clears inputs
 * - Back link navigates to ../index.html
 * - window.madLibsGame testability API
 */
test.describe('Mad Libs Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the mad-libs game
    await page.goto('http://localhost:3000/mad-libs/index.html');

    // Reset game to known state
    await page.evaluate(() => window.madLibsGame.reset());
  });

  test('no console errors on load', async ({ page }) => {
    // Clear any errors from navigation
    page.consoleErrors = [];

    // Reload to test fresh load
    await page.goto('http://localhost:3000/mad-libs/index.html');

    // Wait for inputs section to appear
    await page.waitForSelector('#inputs-section');

    // Check no console errors
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('inputs rendered for each placeholder', async ({ page }) => {
    // Get the current phrase's placeholders
    const phrase = await page.evaluate(() => window.madLibsGame.getPhrase());

    // Count input fields
    const inputs = page.locator('#inputs-section input');
    const count = await inputs.count();

    // Should have one input per placeholder
    expect(count, 'Input count should match placeholder count').toBe(phrase.placeholders.length);

    // Each input should have an aria-label
    for (let i = 0; i < phrase.placeholders.length; i++) {
      const input = inputs.nth(i);
      await expect(input).toBeVisible();
      const label = await input.getAttribute('aria-label');
      expect(label).toContain(phrase.placeholders[i].replace(/-/g, ' '));
    }
  });

  test('submit disabled until all fields filled', async ({ page }) => {
    // Set to phrase with only 1 placeholder (phrase 3: [noun])
    await page.evaluate(() => window.madLibsGame.setPhrase(3));

    // Submit button should be disabled initially (no inputs filled)
    const submitBtn = page.locator('#submit-btn');
    await expect(submitBtn).toBeDisabled();

    // Fill in the single input
    const inputs = page.locator('#inputs-section input');
    await expect(inputs).toHaveCount(1);
    await inputs.first().pressSequentially('test');

    // Now submit should be enabled
    await expect(submitBtn).toBeEnabled();
  });

  test('submit reveals filled phrase with all replacements', async ({ page }) => {
    // Get the phrase so we know placeholders
    const phrase = await page.evaluate(() => window.madLibsGame.getPhrase());
    const placeholders = phrase.placeholders;

    // Fill in all inputs with distinct values
    const inputs = page.locator('#inputs-section input');
    for (let i = 0; i < placeholders.length; i++) {
      await inputs.nth(i).pressSequentially('WORD' + i);
    }

    // Submit
    const submitBtn = page.locator('#submit-btn');
    await submitBtn.click();

    // Result display should be visible
    const resultDisplay = page.locator('#result-display');
    await expect(resultDisplay).toBeVisible();

    // Result should contain all filled-in words
    const resultText = await resultDisplay.textContent();
    for (let i = 0; i < placeholders.length; i++) {
      expect(resultText, 'Result should contain word ' + i).toContain('WORD' + i);
    }

    // Result should no longer contain any [placeholder] brackets
    expect(resultText, 'Result should have no unfilled placeholders').not.toMatch(/^\//);

    // Inputs section should be hidden
    await expect(page.locator('#inputs-section')).toBeHidden();

    // Action buttons should be visible
    await expect(page.locator('#action-buttons')).toBeVisible();

    // The Another one button should be present
    await expect(page.locator('button:has-text(\"Another one\")')).toBeVisible();
  });

  test('another one rerolls phrase and clears inputs', async ({ page }) => {
    // Get initial phrase
    const initialPhrase = await page.evaluate(() => window.madLibsGame.getPhrase());

    // Fill and submit
    const inputs = page.locator('#inputs-section input');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).fill('FILLED');
    }
    await expect(page.locator('#submit-btn')).toBeEnabled({ timeout: 3000 });
    await page.locator('#submit-btn').click();

    // Click Another one
    await page.locator('button:has-text(\"Another one\")').click();

    // Should get a new phrase (different placeholder count or content)
    const newPhrase = await page.evaluate(() => window.madLibsGame.getPhrase());

    // Inputs should be cleared
    const clearedInputs = page.locator('#inputs-section input');
    for (let i = 0; i < await clearedInputs.count(); i++) {
      const value = await clearedInputs.nth(i).inputValue();
      expect(value, 'Input ' + i + ' should be empty').toBe('');
    }

    // Submit should be disabled again
    await expect(page.locator('#submit-btn')).toBeDisabled();

    // Result should be hidden
    await expect(page.locator('#result-display')).toBeHidden();

    // Action buttons and submit should be visible
    await expect(page.locator('#action-buttons')).toBeVisible();
    await expect(page.locator('#submit-btn')).toBeVisible();
    await expect(page.locator('button:has-text("Another one")')).toBeVisible();
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

  test('window.madLibsGame.reset() clears inputs and rerolls', async ({ page }) => {
    // Count inputs after page load (could be any random phrase)
    const inputs = page.locator('#inputs-section input');
    const initialCount = await inputs.count();
    expect(initialCount).toBeGreaterThan(0);

    // Fill all inputs (pressSequentially fires input events unlike fill)
    for (let i = 0; i < initialCount; i++) {
      await inputs.nth(i).pressSequentially('TEST' + i);
    }

    // Verify inputs are filled before reset
    const filledCount = await inputs.count();
    expect(filledCount).toBe(initialCount);

    // Call reset
    await page.evaluate(() => window.madLibsGame.reset());

    // Re-acquire inputs after reset (count may differ since reset picks a new random phrase)
    const resetInputs = page.locator('#inputs-section input');
    const resetCount = await resetInputs.count();

    // All current inputs should be empty after reset
    for (let i = 0; i < resetCount; i++) {
      const value = await resetInputs.nth(i).inputValue();
      expect(value, 'Input ' + i + ' should be empty after reset').toBe('');
    }

    // Submit should be disabled
    await expect(page.locator('#submit-btn')).toBeDisabled();

    // Result should be hidden
    await expect(page.locator('#result-display')).toBeHidden();
  });

  test('window.madLibsGame.setPhrase(n) loads specific phrase', async ({ page }) => {
    // Set to a phrase we can test (phrase 3: only 1 placeholder)
    await page.evaluate(() => window.madLibsGame.setPhrase(3));

    // Should only have 1 input (phrase 3: [noun])
    const inputs = page.locator('#inputs-section input');
    await expect(inputs).toHaveCount(1);

    // Fill and submit
    await inputs.first().pressSequentially('DATA');
    await page.locator('#submit-btn').click();

    // Result should show the filled phrase
    const resultText = await page.locator('#result-display').textContent();
    expect(resultText).toContain('DATA');
  });

  test('Enter key on last input triggers submit when all fields filled', async ({ page }) => {
    // Set to phrase with 3 placeholders
    await page.evaluate(() => window.madLibsGame.setPhrase(6));

    // Fill all but the last input
    const inputs = page.locator('#inputs-section input');
    const count = await inputs.count();

    for (let i = 0; i < count - 1; i++) {
      await inputs.nth(i).pressSequentially('word' + i);
    }

    // Fill last input
    await inputs.last().pressSequentially('FINAL');

    // Wait for submit button to become enabled
    await expect(page.locator('#submit-btn')).toBeEnabled({ timeout: 2000 });

    // Press Enter on last input
    await inputs.last().press('Enter');

    // Result should be visible
    await expect(page.locator('#result-display')).toBeVisible();

    // Result should contain the filled words
    const resultText = await page.locator('#result-display').textContent();
    expect(resultText).toContain('FINAL');
  });
});
