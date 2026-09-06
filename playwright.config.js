import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4001',
  },
  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:4001/health',
    reuseExistingServer: true,
    timeout: 15000,
    env: {
      PORT: '4001',
    },
  },
})
