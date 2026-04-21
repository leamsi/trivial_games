const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Word Scramble game
 *
 * Tests all Word Scramble features including:
 * - Console errors on load
 * - Tier selection (Easy/Medium/Hard)
 * - Core gameplay (correct/wrong guess, score, attempts, game-over)
 * - Hint system (visibility, disabled state, letter reveal, attempt cost)
 * - Review list on game-over screen
 * - window.game API methods
 * - Navigation (reset, back link)
 */
test.describe('Word Scramble Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the word-scramble game
    await page.goto('http://localhost:3000/word-scramble/index.html');

    // Reset game to known state
    await page.evaluate(() => window.game.reset());
  });

  test('no console errors on load', async ({ page }) => {
    // Clear any errors from navigation
    page.consoleErrors = [];

    // Reload to test fresh load
    await page.goto('http://localhost:3000/word-scramble/index.html');

    // Wait for tier selection to appear
    await page.waitForSelector('.tier-selection');

    // Check no console errors
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('tier selection shows three difficulty buttons (Easy/Medium/Hard)', async ({ page }) => {
    const tierButtons = page.locator('.tier-btn');
    await expect(tierButtons).toHaveCount(3);

    // Verify all three difficulty buttons exist
    await expect(page.locator('.tier-btn--easy')).toBeVisible();
    await expect(page.locator('.tier-btn--medium')).toBeVisible();
    await expect(page.locator('.tier-btn--hard')).toBeVisible();

    // Verify tier-screen is visible and play-screen is hidden initially
    await expect(page.locator('#tier-screen')).toBeVisible();
    await expect(page.locator('#play-screen')).toBeHidden();
  });

  test('selecting Easy starts game with 3-5 letter word', async ({ page }) => {
    // Click Easy difficulty
    await page.locator('.tier-btn--easy').click();

    // Play screen should be visible
    await expect(page.locator('#play-screen')).toBeVisible();

    // Get the target word length
    const wordLength = await page.evaluate(() => window.game.getTargetWord().length);

    // Easy words are 3-5 letters
    expect(wordLength).toBeGreaterThanOrEqual(3);
    expect(wordLength).toBeLessThanOrEqual(5);
  });

  test('selecting Medium starts game with 5-7 letter word', async ({ page }) => {
    await page.locator('.tier-btn--medium').click();
    await expect(page.locator('#play-screen')).toBeVisible();

    const wordLength = await page.evaluate(() => window.game.getTargetWord().length);
    expect(wordLength).toBeGreaterThanOrEqual(5);
    expect(wordLength).toBeLessThanOrEqual(7);
  });

  test('selecting Hard starts game with 7+ letter word', async ({ page }) => {
    await page.locator('.tier-btn--hard').click();
    await expect(page.locator('#play-screen')).toBeVisible();

    const wordLength = await page.evaluate(() => window.game.getTargetWord().length);
    expect(wordLength).toBeGreaterThanOrEqual(7);
  });

  test('correct guess increments score and gets next word', async ({ page }) => {
    // Start game
    await page.locator('.tier-btn--easy').click();

    // Get the target word and current score
    const targetWord = await page.evaluate(() => window.game.getTargetWord());
    const initialScore = await page.evaluate(() => window.game.getScore());

    // Make a correct guess
    const result = await page.evaluate(
      (word) => window.game.makeGuess(word),
      targetWord
    );

    // Should return true for correct guess
    expect(result).toBe(true);

    // Score should be incremented
    const newScore = await page.evaluate(() => window.game.getScore());
    expect(newScore).toBe(initialScore + 1);
  });

  test('wrong guess decrements attempts', async ({ page }) => {
    // Start game
    await page.locator('.tier-btn--easy').click();

    const initialAttempts = await page.evaluate(() => window.game.getAttemptsRemaining());

    // Make a wrong guess with a deliberately incorrect word
    const wrongWord = await page.evaluate(() => window.game.makeGuess('xyznotaword'));

    // Should return false for wrong guess
    expect(wrongWord).toBe(false);

    // Attempts should be decremented
    const newAttempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    expect(newAttempts).toBe(initialAttempts - 1);
  });

  test('game-over triggers at 0 attempts', async ({ page }) => {
    // Start game
    await page.locator('.tier-btn--easy').click();

    // Fill wrong guess and keep submitting via the real UI form flow
    const guessInput = page.locator('#guess-input');
    const submitBtn = page.locator('.guess-btn');

    let attempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    while (attempts > 0) {
      // Fill with a deliberately wrong word each iteration
      await guessInput.fill('zzzzz');
      await submitBtn.click();
      // Wait a moment for the DOM update
      await page.waitForTimeout(100);
      attempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    }

    // Game-over screen should be visible
    await expect(page.locator('#game-over-screen')).toBeVisible();

    // Play screen should be hidden
    await expect(page.locator('#play-screen')).toBeHidden();
  });

  test('hint button visible on play screen after tier selection', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();
    await expect(page.locator('#play-screen')).toBeVisible();

    const hintBtn = page.locator('#hint-btn');
    await expect(hintBtn).toBeVisible();
  });

  test('hint button disabled when attemptsRemaining < 2', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();

    // Make 6 wrong guesses to drive attempts below 2 (Easy words give 5-7 attempts)
    // This guarantees attempts < 2 even for 5-letter words (7-6=1)
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => {
        document.getElementById('guess-input').value = 'WRONGX';
        window.game.handleGuess({ preventDefault: () => {} });
      });
      await page.waitForTimeout(50);
    }

    // With 1 or fewer attempts remaining, hint button should be disabled
    const disabled = await page.evaluate(
      () => document.getElementById('hint-btn').disabled
    );
    expect(disabled).toBe(true);
  });

  test('useHint reveals a letter and costs 2 attempts', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();

    const initialAttempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    const initialRevealedCount = await page.evaluate(
      () => window.game.getRevealedIndices().length
    );

    // Use hint — should reveal a letter and cost 2 attempts
    const revealedLetter = await page.evaluate(() => window.game.useHint());

    // A letter should be revealed (not null)
    expect(revealedLetter).not.toBeNull();
    expect(typeof revealedLetter).toBe('string');
    expect(revealedLetter.length).toBe(1);

    // Attempt count should have decreased by 2
    const newAttempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    expect(newAttempts).toBe(initialAttempts - 2);

    // Revealed indices count should increase
    const newRevealedCount = await page.evaluate(
      () => window.game.getRevealedIndices().length
    );
    expect(newRevealedCount).toBe(initialRevealedCount + 1);
  });

  test('getRevealedIndices returns array of revealed indices', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();

    // Use two hints to reveal two letters
    await page.evaluate(() => window.game.useHint());
    await page.evaluate(() => window.game.useHint());

    const revealedIndices = await page.evaluate(() => window.game.getRevealedIndices());

    // Should be an array with 2 indices
    expect(Array.isArray(revealedIndices)).toBe(true);
    expect(revealedIndices).toHaveLength(2);

    // All entries should be integers within word length bounds
    const wordLength = await page.evaluate(() => window.game.getTargetWord().length);
    revealedIndices.forEach(index => {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(wordLength);
    });
  });

  test('solvedWords accumulates correct guesses', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();

    // Solve two words
    const word1 = await page.evaluate(() => window.game.getTargetWord());
    await page.evaluate((w) => window.game.makeGuess(w), word1);

    const word2 = await page.evaluate(() => window.game.getTargetWord());
    await page.evaluate((w) => window.game.makeGuess(w), word2);

    const solvedWords = await page.evaluate(() => window.game.getSolvedWords());

    expect(Array.isArray(solvedWords)).toBe(true);
    expect(solvedWords).toHaveLength(2);
    expect(solvedWords).toContain(word1.toUpperCase());
    expect(solvedWords).toContain(word2.toUpperCase());
  });

  test('review list shows solved words on game-over screen', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();

    // Solve one word using makeGuess (this accumulates solvedWords correctly)
    const solvedWord = await page.evaluate(() => window.game.getTargetWord());
    await page.evaluate((w) => window.game.makeGuess(w), solvedWord);

    // Directly trigger game-over by calling showGameOver()
    // (makeGuess() doesn't call it, but showGameOver() uses current solvedWords)
    await page.evaluate(() => window.game.handleGuess({ preventDefault: () => {} }));

    // Fill a wrong guess to drive attempts to 0 via the real UI flow
    const guessInput = page.locator('#guess-input');
    const submitBtn = page.locator('.guess-btn');

    let attempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    while (attempts > 0) {
      // Set the input value directly so handleGuess reads it
      await page.evaluate(() => {
        document.getElementById('guess-input').value = 'wrongguess';
      });
      await submitBtn.click();
      await page.waitForTimeout(100);
      attempts = await page.evaluate(() => window.game.getAttemptsRemaining());
    }

    // Game-over screen should be visible
    await expect(page.locator('#game-over-screen')).toBeVisible();

    // Review list container should be visible (we solved 1 word)
    await expect(page.locator('#review-list-container')).toBeVisible();

    // Review list should contain the solved word
    const reviewList = page.locator('#review-list');
    await expect(reviewList).toBeVisible();

    const reviewItems = page.locator('#review-list .review-list__item');
    const itemCount = await reviewItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // The solved word should appear in the review list
    const reviewText = await reviewList.textContent();
    expect(reviewText).toContain(solvedWord.toUpperCase());
  });

  test('useHint fills input with next correct character and elides wrong ones', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();
    
    const targetWord = await page.evaluate(() => window.game.getTargetWord().toLowerCase());
    const input = page.locator('#guess-input');
    
    // Case 1: Empty input -> hint fills 1st char
    await input.fill('');
    await page.evaluate(() => window.game.useHint());
    await expect(input).toHaveValue(targetWord[0]);
    
    // Case 2: Partial correct -> hint fills next char
    await input.fill(targetWord.substring(0, 1));
    await page.evaluate(() => window.game.useHint());
    await expect(input).toHaveValue(targetWord.substring(0, 2));
    
    // Case 3: Partial wrong -> hint corrects and elides
    // If target is "apple", guess "ax", hint should result in "ap"
    await input.fill(targetWord[0] + 'z'); 
    await page.evaluate(() => window.game.useHint());
    await expect(input).toHaveValue(targetWord.substring(0, 2));
  });

  test('clicking scrambled letters inputs characters at cursor position', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();
    const input = page.locator('#guess-input');
    
    // Get all scrambled letters
    const letters = page.locator('.scrambled-letter');
    const firstLetter = await letters.first().textContent();
    
    // Click first letter
    await letters.first().click();
    await expect(input).toHaveValue(firstLetter?.toLowerCase());
    
    // Click second letter
    const secondLetter = await letters.nth(1).textContent();
    await letters.nth(1).click();
    await expect(input).toHaveValue((firstLetter + secondLetter).toLowerCase());
    
    // Test cursor insertion: "AB" -> cursor at 1 -> click "C" -> "ACB"
    await input.fill('AB');
    await page.evaluate(() => {
      const el = document.getElementById('guess-input');
      el.setSelectionRange(1, 1);
    });
    const thirdLetter = await letters.nth(2).textContent();
    await letters.nth(2).click();
    await expect(input).toHaveValue('A' + thirdLetter?.toLowerCase() + 'B');
  });

  test('scrambled letters are greyed out when used in input', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();
    const input = page.locator('#guess-input');
    
    // Get the first letter of the scrambled word
    const firstLetter = await page.evaluate(() => window.game.getCurrentWord()[0].toLowerCase());
    
    // Input the letter
    await input.fill(firstLetter);
    
    // The corresponding scrambled letter should have the .used class
    // We find which index has that letter
    const isUsed = await page.evaluate((char) => {
      const letters = Array.from(document.querySelectorAll('.scrambled-letter'));
      const targetIndex = letters.findIndex(el => el.textContent.toLowerCase() === char);
      return letters[targetIndex].classList.contains('used');
    }, firstLetter);
    
    expect(isUsed).toBe(true);
    
    // Remove letter -> should no longer be used
    await input.fill('');
    const isStillUsed = await page.evaluate((char) => {
      const letters = Array.from(document.querySelectorAll('.scrambled-letter'));
      const targetIndex = letters.findIndex(el => el.textContent.toLowerCase() === char);
      return letters[targetIndex].classList.contains('used');
    }, firstLetter);
    
    expect(isStillUsed).toBe(false);
  });

  test('duplicate letters are handled correctly in grey-out logic', async ({ page }) => {
    // Force a word with duplicates if possible, or just use a hard word
    await page.locator('.tier-btn--hard').click();
    const scrambled = await page.evaluate(() => window.game.getCurrentWord());
    
    // Find a letter that repeats in the word
    let duplicateChar = '';
    const counts = {};
    for (const char of scrambled) {
      const c = char.toLowerCase();
      counts[c] = (counts[c] || 0) + 1;
      if (counts[c] === 2) {
        duplicateChar = c;
        break;
      }
    }
    
    if (!duplicateChar) {
      console.log('Skipping duplicate test: no duplicate letters in current word');
      return;
    }

    const input = page.locator('#guess-input');
    
    // Input one instance of the duplicate char
    await input.fill(duplicateChar);
    
    // Only one of the scrambled letters should be .used
    const usedCount = await page.evaluate((char) => {
      return Array.from(document.querySelectorAll('.scrambled-letter'))
        .filter(el => el.textContent.toLowerCase() === char && el.classList.contains('used'))
        .length;
    }, duplicateChar);
    
    expect(usedCount).toBe(1);
    
    // Input second instance
    await input.fill(duplicateChar + duplicateChar);
    
    const usedCount2 = await page.evaluate((char) => {
      return Array.from(document.querySelectorAll('.scrambled-letter'))
        .filter(el => el.textContent.toLowerCase() === char && el.classList.contains('used'))
        .length;
    }, duplicateChar);
    
    expect(usedCount2).toBe(2);
  });

  test('reset returns to tier selection screen', async ({ page }) => {
    // Start a game
    await page.locator('.tier-btn--easy').click();
    await expect(page.locator('#play-screen')).toBeVisible();

    // Reset the game
    await page.evaluate(() => window.game.reset());

    // Tier selection should be visible again
    await expect(page.locator('#tier-screen')).toBeVisible();

    // Play screen and game-over screen should be hidden
    await expect(page.locator('#play-screen')).toBeHidden();
    await expect(page.locator('#game-over-screen')).toBeHidden();
  });

  test('restart button returns to tier selection', async ({ page }) => {
    await page.locator('.tier-btn--easy').click();
    await expect(page.locator('#play-screen')).toBeVisible();

    // Click the restart button
    await page.locator('.restart-btn').click();

    // Tier selection should be visible
    await expect(page.locator('#tier-screen')).toBeVisible();
    await expect(page.locator('#play-screen')).toBeHidden();
  });

  test('back link navigates to index page', async ({ page }) => {
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
});
