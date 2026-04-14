const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npx --yes serve . -p 3000',
    port: 3000,
    timeout: 60000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
