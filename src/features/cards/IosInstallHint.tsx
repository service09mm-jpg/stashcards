import { useState } from "react";
import { needsIosInstallHint } from "@/lib/platform";
import { ShareIosIcon } from "@/ui/icons";

const DISMISSED_KEY = "stashcards.install-hint-dismissed";

/**
 * Підказка про встановлення на iPhone.
 *
 * На Android браузер пропонує встановити застосунок сам. На iOS такої
 * пропозиції не існує: Apple не дає сторінці жодного способу її викликати —
 * ані кнопки, ані події. Єдиний шлях — словами пояснити, куди натиснути.
 *
 * А встановити тут по-справжньому важливо: Safari має право вичистити дані
 * сайту, яким давно не користувалися, і саме додавання на домашній екран
 * виводить застосунок з-під цього правила. Тобто без цього кроку картки
 * одного дня можуть просто зникнути.
 */
export function IosInstallHint() {
  const [hidden, setHidden] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1",
  );

  if (hidden || !needsIosInstallHint()) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm leading-relaxed">
        Додайте застосунок на екран «Додому»: натисніть{" "}
        <ShareIosIcon className="inline size-4 -translate-y-0.5" /> унизу
        Safari, далі «На екран «Додому».
      </p>
      <p className="mt-2 text-xs text-muted">
        Так картки відкриватимуться з іконки й офлайн, а Safari не стиратиме їх
        через тривале невикористання.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 text-sm font-medium text-muted underline underline-offset-4"
      >
        Зрозуміло
      </button>
    </div>
  );
}
