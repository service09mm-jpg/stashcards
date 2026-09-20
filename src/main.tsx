import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";

// Оновлення застосунку ставиться мовчки й застосовується при наступному
// відкритті. Питати дозволу немає сенсу: застосунок відкривають на кілька
// секунд біля каси, і банер «є нова версія» лише завадив би.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
