import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Збірка застосунку.
 *
 * Тут немає нічого серверного: на виході — статичні файли, які роздає CDN.
 * Уся логіка й усі дані живуть у браузері, тому застосунок за визначенням
 * працює офлайн — service worker лише доносить до браузера самі файли.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker оновлюється сам, без запитань до юзера: застосунок
      // маленький, а показувати банер «є нова версія» на екрані з карткою
      // біля каси — найгірше, що можна придумати.
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "favicon.svg"],
      manifest: {
        name: "StashCards — картки лояльності",
        short_name: "StashCards",
        description: "Картки лояльності, що завжди під рукою — навіть без інтернету",
        lang: "uk",
        start_url: "/",
        scope: "/",
        // Головне поле: застосунок відкривається власним вікном, без адресного
        // рядка й вкладок, і стає окремою карткою в списку програм.
        display: "standalone",
        orientation: "portrait",
        background_color: "#09090b",
        theme_color: "#09090b",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // `maskable` — дозвіл системі обрізати іконку під свою форму (коло,
          // квадрат зі скругленням). Знак у ній навмисно менший, із запасом
          // по краях, інакше обрізання з'їло б його кути.
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Застосунок цілком поміщається в precache — саме тому він відкривається
        // офлайн миттєво й без жодного мережевого запиту.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,wasm}"],
        // wasm-декодер сканера важчий за типовий ліміт Workbox (2 МБ).
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Застосунок — SPA: будь-який маршрут віддається тим самим index.html,
        // тож і офлайн, і після перезавантаження глибоке посилання працює.
        navigateFallback: "/index.html",
      },
      devOptions: {
        // Щоб офлайн можна було перевіряти ще в `npm run dev`, а не лише на проді.
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
