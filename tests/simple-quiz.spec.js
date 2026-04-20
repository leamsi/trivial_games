const { test, expect } = require('@playwright/test');

/**
 * Contract compliance tests for Simple Quiz game
 *
 * Tests verify functional behavior against the real implementation:
 * - startGame: shuffle, DOM population, answer buttons
 * - submitAnswer: return shape, score tracking, phase advancement
 * - getReviewItems: shape, length, field completeness
 * - playAgain: reshuffle, sessionBest preservation, screen transition
 * - reset: zeroes sessionBest
 * - Shuffle randomness
 * - Review screen display
 * - Session best tracking
 * - No console errors, back link, UI elements, screen transitions
 *
 * Malformed question handling tests live in a separate describe block to
 * keep their route handlers isolated from the main suite's page context.
 */
test.describe('Simple Quiz Game', () => {
  test.beforeEach(async ({ page }) => {
    page.consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.consoleErrors.push(msg.text());
      }
    });
    await page.goto('http://localhost:3000/simple-quiz/index.html');
    await page.evaluate(() => window.game.reset());
  });

  test.afterEach(async ({ page }) => {
    expect(page.consoleErrors, 'Console errors found: ' + page.consoleErrors.join('; ')).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════
  // LOAD & INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════

  test('no console errors on load', async ({ page }) => {
    page.consoleErrors = [];
    await page.goto('http://localhost:3000/simple-quiz/index.html');
    await page.waitForSelector('#start-screen');
    expect(page.consoleErrors).toHaveLength(0);
  });

  test('start screen visible on load', async ({ page }) => {
    await expect(page.locator('#start-screen')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#quiz-screen')).toBeHidden();
    await expect(page.locator('#review-screen')).toBeHidden();
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

  test('quiz screen hidden initially', async ({ page }) => {
    await expect(page.locator('#quiz-screen')).toBeHidden();
  });

  test('review screen hidden initially', async ({ page }) => {
    await expect(page.locator('#review-screen')).toBeHidden();
  });

  // ═══════════════════════════════════════════════════════════════
  // SCREEN TRANSITIONS
  // ═══════════════════════════════════════════════════════════════

  test('click Start Quiz shows quiz screen and hides start screen', async ({ page }) => {
    await page.locator('#startBtn').click();
    await expect(page.locator('#quiz-screen')).toBeVisible();
    await expect(page.locator('#start-screen')).toBeHidden();
  });

  test('phase is "quiz" after clicking Start Quiz', async ({ page }) => {
    await page.locator('#startBtn').click();
    const phase = await page.evaluate(() => window.game.getPhase());
    expect(phase).toBe('quiz');
  });

  test('initial score and session best are 0', async ({ page }) => {
    const score = await page.evaluate(() => window.game.getScore());
    const sessionBest = await page.evaluate(() => window.game.getSessionBest());
    expect(score).toBe(0);
    expect(sessionBest).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════
  // STARTGAME: SHUFFLE, DOM POPULATION, ANSWER BUTTONS
  // ═══════════════════════════════════════════════════════════════

  test('startGame() shuffles — two calls produce different orders', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const order1 = await page.evaluate(() => window.game.shuffledQuestions.map(q => q.question));
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.startGame());
    const order2 = await page.evaluate(() => window.game.shuffledQuestions.map(q => q.question));
    expect(order1).not.toEqual(order2);
  });

  test('startGame() populates question text in DOM', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const questionText = await page.locator('#questionText').textContent();
    expect(questionText.trim().length).toBeGreaterThan(5);
    expect(questionText).not.toBe('Loading…');
  });

  test('startGame() shows 4 answer buttons with real text', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const buttons = page.locator('.answer-btn');
    await expect(buttons).toHaveCount(4);
    for (const btn of await buttons.all()) {
      const text = await btn.textContent();
      expect(text.trim().length).toBeGreaterThan(3);
    }
  });

  test('startGame() updates progress text to Q 1/10', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const progress = await page.locator('#progressText').textContent();
    expect(progress).toMatch(/Q\s*1\s*\/\s*10/);
  });

  // ═══════════════════════════════════════════════════════════════
  // SUBMITANSWER: RETURN SHAPE, SCORE TRACKING, PHASE ADVANCEMENT
  // ═══════════════════════════════════════════════════════════════

  test('submitAnswer(n) returns {correct: boolean, correctIndex: number}', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.game.reset());
      await page.evaluate(() => window.game.startGame());
      const result = await page.evaluate((idx) => window.game.submitAnswer(idx), i);
      expect(result).toHaveProperty('correct');
      expect(result).toHaveProperty('correctIndex');
      expect(typeof result.correct).toBe('boolean');
      expect(typeof result.correctIndex).toBe('number');
      expect(result.correctIndex).toBeGreaterThanOrEqual(0);
      expect(result.correctIndex).toBeLessThanOrEqual(3);
    }
  });

  test('submitAnswer(n) increments score on correct answer', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const correctIdx = await page.evaluate(() => window.game.shuffledQuestions[0].correct);
    const scoreBefore = await page.evaluate(() => window.game.getScore());
    await page.evaluate((idx) => window.game.submitAnswer(idx), correctIdx);
    const scoreAfter = await page.evaluate(() => window.game.getScore());
    expect(scoreAfter).toBe(scoreBefore + 1);
  });

  test('submitAnswer(n) does not increment score on wrong answer', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const correctIdx = await page.evaluate(() => window.game.shuffledQuestions[0].correct);
    const wrongIdx = correctIdx === 0 ? 1 : 0;
    const scoreBefore = await page.evaluate(() => window.game.getScore());
    await page.evaluate((idx) => window.game.submitAnswer(idx), wrongIdx);
    const scoreAfter = await page.evaluate(() => window.game.getScore());
    expect(scoreAfter).toBe(scoreBefore);
  });

  test('submitAnswer(n) returns correct: false for wrong answer', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const correctIdx = await page.evaluate(() => window.game.shuffledQuestions[0].correct);
    const wrongIdx = correctIdx === 0 ? 1 : 0;
    const result = await page.evaluate((idx) => window.game.submitAnswer(idx), wrongIdx);
    expect(result.correct).toBe(false);
  });

  test('submitAnswer(n) returns correct: true for correct answer', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const correctIdx = await page.evaluate(() => window.game.shuffledQuestions[0].correct);
    const result = await page.evaluate((idx) => window.game.submitAnswer(idx), correctIdx);
    expect(result.correct).toBe(true);
  });

  test('submitAnswer(n) advances phase to "review" after 10 answers', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      const phase = await page.evaluate(() => window.game.getPhase());
      if (phase === 'review') break;
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const phase = await page.evaluate(() => window.game.getPhase());
    expect(phase).toBe('review');
  });

  test('submitAnswer(n) advances question index after each answer', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 3; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const progress = await page.locator('#progressText').textContent();
    expect(progress).toMatch(/Q\s*4\s*\/\s*10/);
  });

  // ═══════════════════════════════════════════════════════════════
  // GETREVIEWITEMS: SHAPE, LENGTH, FIELD COMPLETENESS
  // ═══════════════════════════════════════════════════════════════

  test('getReviewItems() returns array of exactly 10 items after full quiz', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const items = await page.evaluate(() => window.game.getReviewItems());
    expect(items).toHaveLength(10);
  });

  test('getReviewItems() returns objects with question, answers, userIndex, correctIndex', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const items = await page.evaluate(() => window.game.getReviewItems());
    items.forEach((item, idx) => {
      expect(item, 'Item ' + idx + ' should have question').toHaveProperty('question');
      expect(item, 'Item ' + idx + ' should have answers').toHaveProperty('answers');
      expect(item, 'Item ' + idx + ' should have userIndex').toHaveProperty('userIndex');
      expect(item, 'Item ' + idx + ' should have correctIndex').toHaveProperty('correctIndex');
    });
  });

  test('getReviewItems() items have non-empty, non-undefined fields', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const items = await page.evaluate(() => window.game.getReviewItems());
    items.forEach((item, idx) => {
      expect(item.question, 'Item ' + idx + ' question should not be empty').toBeTruthy();
      expect(item.question.length).toBeGreaterThan(0);
      expect(Array.isArray(item.answers), 'Item ' + idx + ' answers should be an array').toBe(true);
      expect(item.answers.length).toBe(4);
      expect(typeof item.userIndex, 'Item ' + idx + ' userIndex should be a number').toBe('number');
      expect(typeof item.correctIndex, 'Item ' + idx + ' correctIndex should be a number').toBe('number');
      expect(item.userIndex).toBeGreaterThanOrEqual(0);
      expect(item.userIndex).toBeLessThanOrEqual(3);
      expect(item.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex).toBeLessThanOrEqual(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PLAYAGAIN: RESHUFFLE, SESSIONBEST PRESERVATION, SCREEN TRANSITION
  // ═══════════════════════════════════════════════════════════════

  test('playAgain() reshuffles — order differs from previous round', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const order1 = await page.evaluate(() => window.game.shuffledQuestions.map(q => q.question));
    await page.evaluate(() => window.game.playAgain());
    const order2 = await page.evaluate(() => window.game.shuffledQuestions.map(q => q.question));
    expect(order1).not.toEqual(order2);
  });

  test('playAgain() preserves sessionBest (when score > best)', async ({ page }) => {
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const score1 = await page.evaluate(() => window.game.getScore());
    const best1 = await page.evaluate(() => window.game.getSessionBest());
    expect(best1).toBe(score1);
    await page.evaluate(() => window.game.playAgain());
    const best2 = await page.evaluate(() => window.game.getSessionBest());
    expect(best2).toBe(best1);
  });

  test('playAgain() shows quiz screen', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    expect(await page.evaluate(() => window.game.getPhase())).toBe('review');
    await page.evaluate(() => window.game.playAgain());
    expect(await page.evaluate(() => window.game.getPhase())).toBe('quiz');
    await expect(page.locator('#quiz-screen')).toBeVisible();
    await expect(page.locator('#review-screen')).toBeHidden();
  });

  test('playAgain button resets score to 0 for the new round', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    await page.evaluate(() => window.game.playAgain());
    const score = await page.evaluate(() => window.game.getScore());
    expect(score).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════
  // RESET: SESSIONBEST ZEROING
  // ═══════════════════════════════════════════════════════════════

  test('reset() zeroes sessionBest to 0', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    const bestBefore = await page.evaluate(() => window.game.getSessionBest());
    expect(bestBefore).toBeGreaterThan(0);
    await page.evaluate(() => window.game.reset());
    const bestAfter = await page.evaluate(() => window.game.getSessionBest());
    expect(bestAfter).toBe(0);
  });

  test('reset() zeroes score and returns to start screen', async ({ page }) => {
    await page.locator('#startBtn').click();
    await page.evaluate(() => window.game.submitAnswer(0));
    await page.evaluate(() => window.game.reset());
    expect(await page.evaluate(() => window.game.getScore())).toBe(0);
    expect(await page.evaluate(() => window.game.getSessionBest())).toBe(0);
    expect(await page.evaluate(() => window.game.getPhase())).toBe('start');
  });

  test('reset is callable at any time', async ({ page }) => {
    await page.evaluate(() => window.game.reset());
    expect(await page.evaluate(() => window.game.getScore())).toBe(0);
    await page.locator('#startBtn').click();
    await page.evaluate(() => window.game.reset());
    expect(await page.evaluate(() => window.game.getScore())).toBe(0);
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    }
    await page.evaluate(() => window.game.reset());
    expect(await page.evaluate(() => window.game.getScore())).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════
  // SHUFFLE RANDOMNESS
  // ═══════════════════════════════════════════════════════════════

  test('shuffled order differs across sessions — 5 iterations, at least 2 differ', async ({ page }) => {
    const orders = [];
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.game.reset());
      await page.evaluate(() => window.game.startGame());
      const order = await page.evaluate(() => window.game.shuffledQuestions.map(q => q.question));
      orders.push(order.join('|'));
    }
    const uniqueOrders = [...new Set(orders)];
    expect(uniqueOrders.length, 'At least 2 different orders expected out of 5 runs').toBeGreaterThanOrEqual(2);
  });

  // --- SESSION BEST TRACKING ---
  test('session best is updated after first round', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    expect(await page.evaluate(() => window.game.getSessionBest())).toBe(await page.evaluate(() => window.game.getScore()));
  });

  test('session best is max across rounds', async ({ page }) => {
    // Round 1: answer all with index 0 (random-ish score)
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => window.game.startGame());
    for (let i = 0; i < 10; i++) await page.evaluate((idx) => window.game.submitAnswer(idx), 0);
    const s1 = await page.evaluate(() => window.game.getScore());
    const b1 = await page.evaluate(() => window.game.getSessionBest());
    expect(b1).toBe(s1);
    // Round 2: answer all with the correct index (guaranteed 10/10) to push best higher
    await page.evaluate(() => window.game.playAgain());
    const questions = await page.evaluate(() => window.game.shuffledQuestions);
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx) => window.game.submitAnswer(idx), questions[i].correct);
    }
    const s2 = await page.evaluate(() => window.game.getScore());
    expect(s2).toBe(10);
    const b2 = await page.evaluate(() => window.game.getSessionBest());
    expect(b2).toBe(Math.max(s1, s2));
  });

  test('getSessionBest returns a number', async ({ page }) => {
    expect(typeof await page.evaluate(() => window.game.getSessionBest())).toBe('number');
  });

  // --- WINDOW.GAME API ---
  test('window.game object exists', async ({ page }) => {
    expect(await page.evaluate(() => typeof window.game !== 'undefined')).toBe(true);
  });

  test('all required API methods exist', async ({ page }) => {
    const methods = ['startGame', 'submitAnswer', 'getScore', 'getSessionBest', 'getReviewItems', 'playAgain', 'reset', 'getPhase'];
    for (const m of methods) {
      expect(await page.evaluate((name) => typeof window.game[name] === 'function', m), m).toBe(true);
    }
  });

  test('shuffledQuestions is an array', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    expect(Array.isArray(await page.evaluate(() => window.game.shuffledQuestions))).toBe(true);
  });

  // --- SCORE & DISPLAY ---
  test('score display shows numeric value', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    expect(parseInt(await page.locator('#scoreDisplay').textContent(), 10)).toBeGreaterThanOrEqual(0);
  });

  test('best display shows numeric value', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    expect(parseInt(await page.locator('#bestDisplay').textContent(), 10)).toBeGreaterThanOrEqual(0);
  });

  test('progress text format is Q N/10', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    expect(await page.locator('#progressText').textContent()).toMatch(/Q\s*\d+\s*\/\s*10/);
  });

  // --- BUTTON VISIBILITY ---
  test('answer buttons are visible after starting quiz', async ({ page }) => {
    await page.evaluate(() => window.game.startGame());
    const btns = page.locator('.answer-btn');
    await expect(btns).toHaveCount(4);
    for (const btn of await btns.all()) await expect(btn).toBeVisible();
  });

  test('playAgain button is in the DOM', async ({ page }) => {
    await expect(page.locator('#playAgainBtn')).toBeAttached();
  });

  test('restart button is always accessible', async ({ page }) => {
    await expect(page.locator('#restartBtn')).toBeAttached();
  });
});

// ─── MALFORMED QUESTIONS SUITE (isolated describe block) ───────────────────
// Route handlers don't leak between describe blocks in Playwright.
test.describe('Simple Quiz Game — Malformed Questions', () => {
  test('malformed questions are skipped with console.error', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.route('**/simple-quiz/index.html', async route => {
      const resp = await route.fetch();
      let body = await resp.text();
      body = body.replace(/var QUESTIONS = \[/, 'var QUESTIONS = [\n        { question: "Valid?", answers: ["A","B","C","D"], correct: 0 },\n        { question: null, answers: ["A","B","C","D"], correct: 0 },\n        { question: "Another valid?", answers: ["A","B","C","D"], correct: 0 },\n        { question: "Bad answers", answers: null, correct: 0 },\n        { question: "Out of range", answers: ["A","B"], correct: 5 },\n        { question: "Missing correct", answers: ["A","B","C","D"] },\n        { question: "Very valid?", answers: ["A","B","C","D"], correct: 2 },\n        ');
      await route.fulfill({ response: resp, body });
    });
    await page.goto('http://localhost:3000/simple-quiz/index.html');
    await page.waitForSelector('#start-screen');
    let threw = false;
    try { await page.evaluate(() => window.game.startGame()); } catch (e) { threw = true; }
    expect(threw).toBe(false);
    expect(errors.length, 'At least one console.error for malformed questions').toBeGreaterThanOrEqual(1);
  });

  test('empty QUESTIONS array does not throw', async ({ page }) => {
    page.on('console', msg => { if (msg.type() === 'error') {} });
    await page.goto('http://localhost:3000/simple-quiz/index.html');
    await page.evaluate(() => window.game.reset());
    await page.evaluate(() => {
      window._test_q_backup = window.QUESTIONS;
      window.QUESTIONS = [];
    });
    let threw = false;
    try { await page.evaluate(() => window.game.startGame()); } catch (e) { threw = true; }
    await page.evaluate(() => { window.QUESTIONS = window._test_q_backup; });
    expect(threw).toBe(false);
  });
});
