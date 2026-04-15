# Trivial Games

A collection of trivial, standalone browser games. Open the HTML file and play.

## Games

| Game | Description |
|------|-------------|
| Pick-a-Number | Guess a number between 1–1000 in 10 tries |
| Coin Flip | Double your cash by betting on coin flips — or lose it all |

Each game is fully self-contained. No accounts, no loading screens, no clutter.

## What This Is

Quick, fun games with a retro arcade aesthetic — Press Start 2P pixel font headers, VT323 terminal font body, dark background with neon green/pink/cyan accents. No accounts, no loading screens, no clutter.

Each game lives in its own subdirectory as a fully self-contained `index.html`. No server, no build step, no install.

## How to Play

**Option 1 — direct open:**

```bash
# macOS
open pick-a-number/index.html

# Linux
xdg-open pick-a-number/index.html

# Windows
start pick-a-number/index.html
```

**Option 2 — local server (recommended for development):**

```bash
npx serve .
# then open http://localhost:3000
```

## Pick-a-Number

I'm thinking of a number between 1 and 1000. You have 10 guesses.

- Submit a guess — I'll tell you **higher** or **lower**
- Remaining guesses shown as a visual pip tracker
- Win with confetti celebration
- Restart any time with the ↻ button

## Coin Flip

Bet your cash on a coin flip. Start with $10, aim for $1000.

- Choose heads or tails, set your bet, flip
- Win: cash increases by your bet amount
- Lose: cash decreases by your bet amount
- Reach $0 and it's game over
- CSS 3D coin flip animation, no images or canvas needed

## Development

```bash
# Run the smoke test suite
npx playwright test
```

Tests are fully self-contained — `npx playwright test` automatically starts a static file server on port 3000 and runs all tests against it.

## Adding a New Game

1. Create a subdirectory: `mkdir my-new-game`
2. Add an `index.html` inside it
3. Import the shared stylesheet: `<link rel="stylesheet" href="../common/style.css">`
4. Include the back-link: `<a href="../index.html" class="back-link">← Back to Trivial Games</a>`
5. Follow patterns in existing games for structure and testability
6. Update the games table in `index.html` at the project root
7. Add Playwright tests in `tests/my-new-game.spec.js`

## File Structure

```
/
├── index.html              ← Project root, lists all games
├── common/
│   └── style.css          ← Shared retro arcade CSS
├── pick-a-number/
│   └── index.html         ← Self-contained game
├── coin-flip/
│   └── index.html         ← Self-contained game
└── tests/
    ├── playwright.config.js
    ├── pick-a-number.spec.js
    └── coin-flip.spec.js
```

## Tech Stack

- Pure HTML/CSS/JavaScript — no framework, no bundler
- Google Fonts: Press Start 2P (headings), VT323 (body)
- Canvas particle system for confetti with CSS `@keyframes bounce` animation fallback
- Playwright for smoke testing
