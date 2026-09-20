import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    // Запасний шлях для середовищ, де Chromium уже стоїть у системі й
    // завантажувати власну копію нікуди (контейнери, CI без мережі):
    // CHROMIUM_PATH=/шлях/до/chrome npm run test:e2e. Без змінної все
    // працює звичайним чином, на браузері з `npx playwright install`.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  projects: [
    // Мобільний профіль головний: застосунок насамперед відкривають із
    // телефона біля каси, а вже потім — із ноутбука.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Саме `build` + `preview`, а не `dev`: перевіряти треба ту збірку, що
    // поїде на прод, разом зі справжнім service worker.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
