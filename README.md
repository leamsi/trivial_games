# Trivial Games

A collection of trivial, standalone browser games. Open the HTML file and play.

## Games

| Game | Location |
|------|----------|
| Pick-a-Number | [pick-a-number/index.html](pick-a-number/index.html) |

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
- Win with confetti celebration
- Restart any time with the ↻ button

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
4. Follow the patterns in `pick-a-number/index.html` for structure and testability
5. Update `index.html` at the project root to list the new game with the date added
6. Add Playwright tests in `tests/smoke.spec.js`

## Tech Stack

- Pure HTML/CSS/JavaScript — no framework, no bundler
- Google Fonts: Press Start 2P (headings), VT323 (body)
- canvas-confetti via CDN with CSS bounce animation fallback
- Playwright for smoke testing

## File Structure

```
/
├── index.html              ← Project root, lists all games
├── common/
│   └── style.css          ← Shared retro arcade CSS
├── pick-a-number/
│   └── index.html         ← Self-contained game
└── tests/
    ├── playwright.config.js
    └── smoke.spec.js
```
