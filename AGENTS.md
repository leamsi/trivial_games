# Agents

Working on this codebase? Start here.

## Project Overview

**Trivial Games** is a series of trivial, standalone browser-based games. Each game lives in its own subdirectory with a self-contained `index.html`. No server, no build step — open the HTML file and play.

- **Stack:** Pure HTML/CSS/JS, no framework, no bundler
- **CDN dependencies:** Google Fonts (Press Start 2P, VT323), canvas-confetti (optional, graceful fallback exists)
- **Testing:** Playwright with `webServer` config — `npx playwright test` starts serve automatically
- **CSS:** Shared `/common/style.css` imported via `../common/style.css` relative path. All games use CSS variables from this file.
- **Testability:** Each game exposes a `window.game` object with `setTarget(n)`, `getTarget()`, `reset()` for Playwright control. For complex games like `text-adventure`, this object also includes `executeCommand(cmd)`, `getCurrentRoom()`, and `getInventory()`.

## Build and Test Commands

```bash
# Run the full Playwright smoke suite (starts serve automatically)
npx playwright test

# Run tests with UI
npx playwright test --ui

# Run tests in headed mode (see the browser)
npx playwright test --headed

# Serve locally (port 3000) — useful for manual browser testing
npx serve .
```

## Style Guidelines

### CSS

- **Back to index link (REQUIRED):** Every game MUST include `<a href="../index.html" class="back-link">← Back to Trivial Games</a>` in the `<body>` so players can navigate back to the game list.
- **Import shared styles** in every game HTML: `<link rel="stylesheet" href="../common/style.css">`
- **Use CSS variables** from `common/style.css` — do not hardcode colors, fonts, or spacing values
- **Retro arcade palette:**
  - Background: `--color-bg: #0a0a1a`
  - Neon green: `--neon-green: #00ff41`
  - Neon pink: `--neon-pink: #ff00de`
  - Neon cyan: `--neon-cyan: #00e5ff`
  - Neon yellow: `--neon-yellow: #ffe600`
  - Success: `--color-success: #4ecca3`
  - Warning: `--color-warning: #ffc107`
- **Fonts:** Headings use `--font-heading` (Press Start 2P), body uses `--font-body` (VT323)
- **Neon glow on interactive elements:** Buttons and inputs use glow box-shadows (e.g., `--glow-neon-cyan`)
- **Responsive floor:** 320px minimum. Use `min-width` on containers and `rem`/`em` units. Add a `@media (max-width: 360px)` breakpoint for small phones.

### JavaScript

- **Wrap in an IIFE** with `'use strict'`
- **Expose a `window.game` object** with at minimum `setTarget(n)`, `getTarget()`, `reset()` for testability
- **Input validation:** HTML5 attrs (`type="number"`, `min`, `max`, `required`) plus a desktop `keydown` handler that blocks non-digit keys
- **Mobile keyboard:** Add `inputmode="numeric"` and `pattern="[0-9]*"` to number inputs
- **Confetti:** Use a custom canvas particle system with a CSS `@keyframes bounce` fallback — no need to CDN the confetti library
- **Error messages:** Show inline, do not consume a guess

### File Naming and Structure

```
/
├── index.html              # Root listing (update when adding a game)
├── common/
│   └── style.css           # Shared retro arcade CSS
├── pick-a-number/
│   └── index.html          # Game subdirectory + self-contained HTML
├── coin-flip/
│   └── index.html          # Coin flip gambling game
├── tests/
│   ├── playwright.config.js
│   ├── pick-a-number.spec.js
│   └── coin-flip.spec.js
└── [new-game]/
    └── index.html
```

## Testing Instructions

### Playwright Config

The `webServer` entry in `playwright.config.js` handles `npx serve .` on port 3000. Tests run against `http://localhost:3000`. **Do not change the port** without updating all test base URLs.

### Running Tests

```bash
# Full suite
npx playwright test

# Single spec
npx playwright test tests/pick-a-number.spec.js
npx playwright test tests/coin-flip.spec.js

# Single test
npx playwright test -g "no console errors"
```

## Technical Patterns

### Testing Complex Games (Text Adventure Example)
For games with complex state or randomization, `setTarget(n)` should set the random seed to ensure deterministic behavior during tests. `getTarget()` returns the current seed. Additionally, exposing methods like `executeCommand(cmd)` allows Playwright to interact with the game engine directly, bypassing the need for complex DOM interactions for every step.

### CSS 3D coin flip animation
Use CSS 3D transforms for flip animations: `.coin-scene { perspective: 600px }` container,
`.coin { transform-style: preserve-3d }`, and `.coin__face { backface-visibility: hidden }`.
Heads face (front) shows by default; tails face (back) is rotated 180deg. During a flip,
`rotateY(1800deg)` over 1.5s gives 5 full rotations with a 15deg X-axis tilt for depth.
The `.flipping` class triggers the animation; after `animationend`, `.show-heads` or
`.show-tails` class sets the final resting transform. Both faces always remain in the DOM
—no JS swapping needed. Pure CSS, no canvas or image dependencies.

### CSS animationend timing with test timeouts
When a game flow includes a CSS animation before showing a screen (e.g., win/lose after
a 1.5s coin flip + 500ms setTimeout), total worst-case time approaches 2000ms. Set Playwright
test timeouts to 5000ms to avoid edge-case flakiness. Use a setTimeout fallback alongside
the `animationend` event listener as a safety net.

### Named function for event listener cleanup
When registering one-shot event listeners (animationend, transitionend), store the handler
as a named function on the game object (`game.coinAnimationHandler = function() { ... }`)
so it can be removed on cleanup (playAgain, restart). Anonymous functions cannot be removed
with `removeEventListener`.

### Payout math: bet amount added, not total doubled
On a correct coin flip guess, cash increases by the bet amount (not doubled). Starting at $10,
reaching $1000 requires 6-7 correct consecutive all-in bets. Adding the bet amount preserves
the challenge—doubling the total would trivialize the game.

## Security Considerations

- **No server-side code.** Everything is static. There are no SQL queries, environment variables, or secrets to leak.
- **CDN dependencies.** Games load Google Fonts and canvas-confetti from CDN. The confetti particle system has a CSS bounce fallback for offline/CDN-failure scenarios. Font fallbacks are defined in the font stack.
- **No user input stored.** The game is stateless — refresh restarts. No localStorage, no cookies.
- **No XSS vectors.** All game output is plain text. Do not insert user-provided strings as HTML without escaping.
- **Playwright test isolation.** Tests run in a sandboxed browser context. Do not use `page.evaluate` with unsanitized user input.
