import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Конфіг тестів окремо від `vite.config.ts` навмисно: збірочний конфіг тягне
 * плагін PWA, який у тестах лише марно генерував би service worker.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.mts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
