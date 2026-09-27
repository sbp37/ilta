import { defineConfig, devices } from '@playwright/test'

// 브라우저는 환경에 이미 설치된 것을 쓴다 (PLAYWRIGHT_BROWSERS_PATH).
// 로컬에서 처음 돌린다면: npx playwright install chromium
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  // CI에서만 한 번 재시도하고, 실패 흔적(trace)과 HTML 리포트를 남긴다
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/ilta/',
    ...devices['Pixel 5'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/ilta/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
