const { test, expect } = require('@playwright/test');

/**
 * Smoke tests for Math Marathon game
 *
 * Tests all Math Marathon features including:
 * - Console errors on load
 * - Timer bar shrinking via requestAnimationFrame
 * - Auto-submit on correct digit count
 * - Difficulty scaling (time shrinks with streak)
 * - Wrong answer red flash
 * - Game-over on timer expiration
 * - Play Again vs Restart behavior
 * - window.mathMarathonGame API methods
 * - Navigation (back link)
 */
test.describe('Math Marathon Game', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });

    // Navigate to the math-marathon game
    await page.goto('http://localhost:3000/math-marathon/index.html');

    // Reset game to known state
    await page.evaluate(() => window.mathMarathonGame.reset());
  });

  // ═══════════════════════════════════════════════════════════════
  // LOAD & INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════

  test('no console errors on load', async ({ page }) => {
    page.consoleErrors = [];
    await page.goto('http://localhost:3000/math-marathon/index.html');
    await page.waitForSelector('#answerInput');
    expect(page.consoleErrors, 'Console errors found on load').toHaveLength(0);
  });

  test('page loads with all main elements visible', async ({ page }) => {
    await expect(page.locator('#playScreen')).toBeVisible();
    await expect(page.locator('#timerFill')).toBeVisible();
    await expect(page.locator('#problemDisplay')).toBeVisible();
    await expect(page.locator('#answerInput')).toBeVisible();
    await expect(page.locator('#scoreDisplay')).toBeVisible();
    await expect(page.locator('#bestDisplay')).toBeVisible();
    await expect(page.locator('#restartBtn')).toBeVisible();
  });

  test('game starts in playing phase', async ({ page }) => {
    const phase = await page.evaluate(() => window.mathMarathonGame.getPhase());
    expect(phase).toBe('playing');
  });

  test('initial score and session best are 0', async ({ page }) => {
    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    const sessionBest = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(score).toBe(0);
    expect(sessionBest).toBe(0);
  });

  test('back link navigates to index page', async ({ page }) => {
    const backLink = page.locator('.back-link');
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute('href');
    expect(href).toBe('../index.html');

    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      backLink.click()
    ]);

    await expect(page).toHaveURL('http://localhost:3000/');
  });

  // ═══════════════════════════════════════════════════════════════
  // TIMER & DIFFICULTY
  // ═══════════════════════════════════════════════════════════════

  test('timer bar shrinks during play (requestAnimationFrame animation)', async ({ page }) => {
    // Set a 1000ms timer so we can measure ~60% remaining after 600ms
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(1000));
    await page.waitForTimeout(100); // let the bar render at 100%

    // Get initial width
    const initialWidth = await page.evaluate(() => {
      return parseFloat(document.getElementById('timerFill').style.width);
    });
    expect(initialWidth).toBeGreaterThan(85); // should be ~100% (allow some rAF overhead)

    // Wait 600ms (60% of 1000ms should remain ≈ 60%)
    await page.waitForTimeout(600);

    // Bar should have shrunk
    const widthAfter = await page.evaluate(() => {
      return parseFloat(document.getElementById('timerFill').style.width);
    });
    expect(widthAfter).toBeLessThan(initialWidth);
    // Should be roughly 40% or less remaining after 600ms of a 1000ms timer
    expect(widthAfter).toBeLessThan(50);
  });

  test('difficulty scaling: streak of 7 reduces timeLimit to ~6029ms', async ({ page }) => {
    // After 7 correct, formula: 10000 - 7*567 = 6029
    await page.evaluate(() => window.mathMarathonGame.setStreak(7));
    const timeLimit = await page.evaluate(() => window.mathMarathonGame.getTimeLimit());
    expect(timeLimit).toBeGreaterThanOrEqual(6000);
    expect(timeLimit).toBeLessThanOrEqual(6100);
  });

  test('difficulty scaling: streak of 0 gives full 10000ms', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setStreak(0));
    const timeLimit = await page.evaluate(() => window.mathMarathonGame.getTimeLimit());
    expect(timeLimit).toBe(10000);
  });

  test('difficulty scaling: streak of 15+ caps at 1500ms', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setStreak(15));
    const timeLimit = await page.evaluate(() => window.mathMarathonGame.getTimeLimit());
    // formula gives: 10000 - 15*567 = 1495, capped at Math.max(1500, ...)
    // The cap is Math.max(1500, 1495) = 1500
    expect(timeLimit).toBe(1500);
  });

  test('setStreak updates correctCount (streak getter)', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setStreak(5));
    const streak = await page.evaluate(() => window.mathMarathonGame.getStreak());
    expect(streak).toBe(5);
  });

  // ═══════════════════════════════════════════════════════════════
  // AUTO-SUBMIT
  // ═══════════════════════════════════════════════════════════════

  test('auto-submit 1-digit answer increments score', async ({ page }) => {
    // 3 × 3 = 9 (1 digit)
    await page.evaluate(() => window.mathMarathonGame.setProblem(3, '\u00d7', 3, 9));

    // Type the correct 1-digit answer
    const input = page.locator('#answerInput');
    await input.fill('9');

    // Wait a tick for the input event to fire and auto-submit
    await page.waitForTimeout(200);

    // Score should have incremented
    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(1);

    // Streak should have incremented
    const streak = await page.evaluate(() => window.mathMarathonGame.getStreak());
    expect(streak).toBe(1);

    // Input should be cleared after correct auto-submit
    const inputVal = await input.inputValue();
    expect(inputVal).toBe('');
  });

  test('auto-submit 2-digit answer increments score', async ({ page }) => {
    // 7 × 7 = 49 (2 digits)
    await page.evaluate(() => window.mathMarathonGame.setProblem(7, '\u00d7', 7, 49));

    const input = page.locator('#answerInput');
    await input.fill('49');
    await page.waitForTimeout(200);

    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(1);
  });

  test('auto-submit 3-digit answer increments score', async ({ page }) => {
    // 99 + 99 = 198 (3 digits)
    await page.evaluate(() => window.mathMarathonGame.setProblem(99, '+', 99, 198));

    const input = page.locator('#answerInput');
    await input.fill('198');
    await page.waitForTimeout(200);

    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(1);
  });

  test('wrong answer of correct digit length triggers red flash (input--error)', async ({ page }) => {
    // 3 × 3 = 9 (1 digit). Type a wrong 1-digit answer.
    await page.evaluate(() => window.mathMarathonGame.setProblem(3, '\u00d7', 3, 9));

    const input = page.locator('#answerInput');
    await input.fill('7'); // wrong answer
    await page.waitForTimeout(50);

    // input--error class should be added
    const hasError = await page.evaluate(() =>
      document.getElementById('answerInput').classList.contains('input--error')
    );
    expect(hasError).toBe(true);

    // Score should NOT have incremented
    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(0);

    // After 300ms the error class should be removed
    await page.waitForTimeout(350);
    const errorGone = await page.evaluate(() =>
      document.getElementById('answerInput').classList.contains('input--error')
    );
    expect(errorGone).toBe(false);
  });

  test('correct answer via submitAnswer API increments score', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setProblem(5, '+', 3, 8));
    await page.evaluate(() => window.mathMarathonGame.submitAnswer(8));

    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(1);
  });

  // ═══════════════════════════════════════════════════════════════
  // GAME FLOW
  // ═══════════════════════════════════════════════════════════════

  test('game-over fires when timer expires', async ({ page }) => {
    // Set a 200ms timer and wait long enough for it to fire
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(200));
    await page.waitForTimeout(400); // give the setTimeout time to fire

    const phase = await page.evaluate(() => window.mathMarathonGame.getPhase());
    expect(phase).toBe('gameover');

    await expect(page.locator('#gameOverScreen')).toBeVisible();
    await expect(page.locator('#playScreen')).toBeHidden();
  });

  test('game-over screen shows final score and best', async ({ page }) => {
    // Score 3 correct answers first
    for (let i = 0; i < 3; i++) {
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a), answer);
    }

    // Trigger game-over immediately
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);

    const finalScoreText = await page.locator('#finalScore').textContent();
    const finalBestText = await page.locator('#finalBest').textContent();

    expect(finalScoreText).toContain('3');
    // Best should be at least 3 (may be same as score if no prior session)
    expect(finalBestText).toContain('3');
  });

  test('Play Again button preserves session best', async ({ page }) => {
    // Score 2 correct answers
    for (let i = 0; i < 2; i++) {
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a), answer);
    }

    const bestBefore = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(bestBefore).toBe(2);

    // Trigger game-over
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);

    // Click Play Again
    await page.locator('#playAgainBtn').click();
    await page.waitForTimeout(200);

    // Session best should be preserved
    const bestAfter = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(bestAfter).toBe(bestBefore);

    // Score should be reset to 0
    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(0);

    // Should be back in playing phase
    const phase = await page.evaluate(() => window.mathMarathonGame.getPhase());
    expect(phase).toBe('playing');
  });

  test('Restart button zeroes session best', async ({ page }) => {
    // Score 3 correct answers
    for (let i = 0; i < 3; i++) {
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a), answer);
    }

    // Trigger game-over
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);

    // Click Restart
    await page.locator('#restartBtn').click();
    await page.waitForTimeout(200);

    // Session best should be zero
    const best = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(best).toBe(0);

    // Score should be 0
    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(0);
  });

  test('session best tracks max score across Play Again rounds', async ({ page }) => {
    // Round 1: score 2
    for (let i = 0; i < 2; i++) {
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a), answer);
    }
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);
    await page.locator('#playAgainBtn').click();
    await page.waitForTimeout(100);

    const bestAfterRound1 = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(bestAfterRound1).toBe(2);

    // Round 2: score 1
    const answer2 = await page.evaluate(() => window.mathMarathonGame.getAnswer());
    await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a), answer2);
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);
    await page.locator('#playAgainBtn').click();
    await page.waitForTimeout(100);

    // Session best should still be 2 (the max)
    const bestAfterRound2 = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(bestAfterRound2).toBe(2);
  });

  test('reset() zeroes session best and restarts', async ({ page }) => {
    // Score 4
    for (let i = 0; i < 4; i++) {
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a), answer);
    }

    // Call reset
    await page.evaluate(() => window.mathMarathonGame.reset());

    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    const best = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(score).toBe(0);
    expect(best).toBe(0);
    expect(await page.evaluate(() => window.mathMarathonGame.getPhase())).toBe('playing');
  });

  // ═══════════════════════════════════════════════════════════════
  // WINDOW API
  // ═══════════════════════════════════════════════════════════════

  test('getAnswer returns the correct answer for current problem', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setProblem(8, '+', 7, 15));
    const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
    expect(answer).toBe(15);
  });

  test('getPhase returns "playing" initially', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.reset());
    const phase = await page.evaluate(() => window.mathMarathonGame.getPhase());
    expect(phase).toBe('playing');
  });

  test('getPhase returns "gameover" after timer expires', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(100));
    await page.waitForTimeout(300);
    const phase = await page.evaluate(() => window.mathMarathonGame.getPhase());
    expect(phase).toBe('gameover');
  });

  test('setProblem restarts timer with new problem', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setProblem(4, '\u00d7', 4, 16));
    await page.waitForTimeout(50);

    // Timer should be running (bar not at 0)
    const barWidth = await page.evaluate(() =>
      parseFloat(document.getElementById('timerFill').style.width)
    );
    expect(barWidth).toBeGreaterThan(90);

    // Problem display should show the new problem
    const problemText = await page.locator('#problemDisplay').textContent();
    expect(problemText).toContain('4');
    expect(problemText).toContain('\u00d7'); // ×
  });

  test('window.mathMarathonGame object exists with all methods', async ({ page }) => {
    const methods = [
      'getAnswer', 'getScore', 'getSessionBest', 'getStreak',
      'getTimeLimit', 'getPhase', 'setProblem', 'setTimeLimit',
      'setStreak', 'submitAnswer', 'reset'
    ];

    for (const method of methods) {
      const exists = await page.evaluate((m) => typeof window.mathMarathonGame[m] === 'function', method);
      expect(exists, `Method ${method} should exist`).toBe(true);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  test('restart button is always visible', async ({ page }) => {
    await expect(page.locator('#restartBtn')).toBeVisible();

    // Still visible after game-over
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);
    await expect(page.locator('#restartBtn')).toBeVisible();
  });

  test('problem display contains a math operator', async ({ page }) => {
    const problemText = await page.locator('#problemDisplay').textContent();
    // Should contain +, -, ×, or ÷
    expect(problemText).toMatch(/[\+\-\u00d7\u00f7]/);
  });

  test('division problems generate integer answers', async ({ page }) => {
    // Try 10 division problems and verify all are integers
    for (let i = 0; i < 10; i++) {
      // Get answer and check it's an integer
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      expect(Number.isInteger(answer), `Answer ${answer} should be integer`).toBe(true);

      // Submit wrong answer to advance to next problem (auto-submit on wrong = input clears after 300ms)
      await page.evaluate((a) => window.mathMarathonGame.submitAnswer(a + 9999), answer);
      await page.waitForTimeout(50);
    }
  });

  test('desktop keydown handler blocks non-digit keys', async ({ page }) => {
    const input = page.locator('#answerInput');
    await input.focus();

    // Try to type a letter — it should be blocked
    await page.keyboard.press('a');
    const inputValue = await input.inputValue();
    expect(inputValue).not.toBe('a');

    // Digits should be accepted
    await page.keyboard.press('5');
    const digitValue = await input.inputValue();
    expect(digitValue).toBe('5');
  });

  test('input clears after correct auto-submit', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setProblem(2, '+', 2, 4));
    const input = page.locator('#answerInput');
    await input.fill('4');
    await page.waitForTimeout(200);

    const value = await input.inputValue();
    expect(value).toBe('');
  });

  test('score and best displays update after correct answer', async ({ page }) => {
    const scoreEl = page.locator('#scoreDisplay');
    const bestEl = page.locator('#bestDisplay');

    // Initial state
    expect(await scoreEl.textContent()).toBe('0');
    expect(await bestEl.textContent()).toBe('0');

    // Correct answer
    await page.evaluate(() => window.mathMarathonGame.setProblem(9, '-', 3, 6));
    await page.locator('#answerInput').fill('6');
    await page.waitForTimeout(200);

    expect(await scoreEl.textContent()).toBe('1');
    expect(await bestEl.textContent()).toBe('1');
  });

  test('multiple correct answers accumulate score', async ({ page }) => {
    const answers = [7, 25, 36]; // 7×1, 5×5, 6×6
    const problems = [
      { a: 7, op: '+', b: 0 }, // 7
      { a: 5, op: '\u00d7', b: 5 }, // 25
      { a: 6, op: '\u00d7', b: 6 }, // 36
    ];

    for (let i = 0; i < 3; i++) {
      const { a, op, b } = problems[i];
      const answer = answers[i];
      await page.evaluate(
        (args) => window.mathMarathonGame.setProblem(args.a, args.op, args.b, args.answer),
        { a, op, b, answer }
      );
      await page.locator('#answerInput').fill(String(answer));
      await page.waitForTimeout(200);
    }

    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    expect(score).toBe(3);

    const best = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(best).toBe(3);
  });

  test('playAgain button resets score to 0 but keeps best', async ({ page }) => {
    // Score 1
    await page.evaluate(() => window.mathMarathonGame.setProblem(3, '+', 4, 7));
    await page.locator('#answerInput').fill('7');
    await page.waitForTimeout(200);

    // Game over
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);

    // Play Again
    await page.locator('#playAgainBtn').click();
    await page.waitForTimeout(100);

    const score = await page.evaluate(() => window.mathMarathonGame.getScore());
    const best = await page.evaluate(() => window.mathMarathonGame.getSessionBest());
    expect(score).toBe(0);
    expect(best).toBe(1);
  });

  test('consecutive Play Again rounds accumulate best', async ({ page }) => {
    // Round 1: score 1
    await page.evaluate(() => window.mathMarathonGame.setProblem(4, '+', 3, 7));
    await page.locator('#answerInput').fill('7');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);
    await page.locator('#playAgainBtn').click();
    await page.waitForTimeout(100);

    expect(await page.evaluate(() => window.mathMarathonGame.getSessionBest())).toBe(1);
    expect(await page.evaluate(() => window.mathMarathonGame.getScore())).toBe(0);

    // Round 2: score 2
    for (let i = 0; i < 2; i++) {
      const answer = await page.evaluate(() => window.mathMarathonGame.getAnswer());
      await page.locator('#answerInput').fill(String(answer));
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);
    await page.locator('#playAgainBtn').click();
    await page.waitForTimeout(100);

    // Best should be 2 (new max)
    expect(await page.evaluate(() => window.mathMarathonGame.getSessionBest())).toBe(2);
  });

  test('game-over triggers on wrong answer does NOT end game (only timer ends game)', async ({ page }) => {
    // Wrong answer only flashes red, does not end game
    await page.evaluate(() => window.mathMarathonGame.setProblem(5, '+', 5, 10));
    await page.locator('#answerInput').fill('99'); // wrong
    await page.waitForTimeout(400);

    const phase = await page.evaluate(() => window.mathMarathonGame.getPhase());
    expect(phase).toBe('playing');
    await expect(page.locator('#playScreen')).toBeVisible();
    await expect(page.locator('#gameOverScreen')).toBeHidden();
  });

  test('score increments on each correct auto-submit with incrementing streak', async ({ page }) => {
    const problems = [
      { a: 2, op: '+', b: 2, answer: 4 },
      { a: 3, op: '+', b: 3, answer: 6 },
    ];

    for (const { a, op, b, answer } of problems) {
      await page.evaluate(
        (args) => window.mathMarathonGame.setProblem(args.a, args.op, args.b, args.answer),
        { a, op, b, answer }
      );
      await page.locator('#answerInput').fill(String(answer));
      await page.waitForTimeout(200);
    }

    expect(await page.evaluate(() => window.mathMarathonGame.getScore())).toBe(2);
    expect(await page.evaluate(() => window.mathMarathonGame.getStreak())).toBe(2);
  });

  test('restart button visible on game-over screen', async ({ page }) => {
    await page.evaluate(() => window.mathMarathonGame.setTimeLimit(50));
    await page.waitForTimeout(300);
    await expect(page.locator('#restartBtn')).toBeVisible();
  });
});