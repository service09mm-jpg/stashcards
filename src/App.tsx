import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { HomePage } from "@/features/cards/HomePage";
import { requestPersistentStorage } from "@/lib/db";

/**
 * Екрани, крім списку, підвантажуються окремо.
 *
 * Генератор штрихкодів і wasm-декодер разом важать більше за весь інший
 * застосунок, а на першому екрані не потрібен жоден із них. Тримати їх в
 * основному файлі означало б змусити список чекати на код, який знадобиться
 * лише через дотик. Service worker кладе ці частини в кеш разом з усім
 * іншим, тож офлайн вони так само на місці — просто читаються тоді, коли
 * справді потрібні.
 */
const CardViewPage = lazy(async () => ({
  default: (await import("@/features/cards/CardViewPage")).CardViewPage,
}));
const CardEditorPage = lazy(async () => ({
  default: (await import("@/features/cards/CardEditorPage")).CardEditorPage,
}));
const SettingsPage = lazy(async () => ({
  default: (await import("@/features/settings/SettingsPage")).SettingsPage,
}));

export function App() {
  // Просимо браузер вважати наші дані постійними одразу на старті: що раніше
  // це зроблено, то менше шансів, що сховище вичистять до того, як юзер
  // здогадається зробити копію.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    // Порожній fallback навмисно: частини читаються з кешу за мілісекунди, і
    // будь-який індикатор тут встиг би лише блимнути.
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<CardEditorPage mode="create" />} />
        <Route path="/card/:id" element={<CardViewPage />} />
        <Route path="/card/:id/edit" element={<CardEditorPage mode="edit" />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Будь-яка невідома адреса веде до списку — губитися тут нема де. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
