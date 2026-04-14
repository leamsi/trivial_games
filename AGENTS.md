# Agents

Working on this codebase? Start here.

## Project Overview

**Trivial Games** is a series of trivial, standalone browser-based games. Each game lives in its own subdirectory with a self-contained `index.html`. No server, no build step — open the HTML file and play.

- **Stack:** Pure HTML/CSS/JS, no framework, no bundler
- **CDN dependencies:** Google Fonts (Press Start 2P, VT323), canvas-confetti (optional, graceful fallback exists)
- **Testing:** Playwright with `webServer` config — `npx playwright test` starts serve automatically
- **CSS:** Shared `/common/style.css` imported via `../common/style.css` relative path. All games use CSS variables from this file.
- **Testability:** Each game exposes a `window.game` object with `setTarget(n)`, `getTarget()`, `reset()` for Playwright control

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
│   └── index.html           # Game subdirectory + self-contained HTML
├── tests/
│   ├── playwright.config.js
│   └── smoke.spec.js
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
npx playwright test tests/smoke.spec.js

# Single test
npx playwright test -g "no console errors"
```

## Security Considerations

- **No server-side code.** Everything is static. There are no SQL queries, environment variables, or secrets to leak.
- **CDN dependencies.** Games load Google Fonts and canvas-confetti from CDN. The confetti particle system has a CSS bounce fallback for offline/CDN-failure scenarios. Font fallbacks are defined in the font stack.
- **No user input stored.** The game is stateless — refresh restarts. No localStorage, no cookies.
- **No XSS vectors.** All game output is plain text. Do not insert user-provided strings as HTML without escaping.
- **Playwright test isolation.** Tests run in a sandboxed browser context. Do not use `page.evaluate` with unsanitized user input.
