import type { Page } from "@playwright/test";

/**
 * Додає картку через ручне введення коду.
 *
 * Сканер навмисно не використовується: камери в тестовому браузері немає, і це
 * добре відтворює реальну ситуацію, коли доступ до камери заборонений —
 * застосунок має лишатися повністю придатним і в такому стані.
 */
export async function addCard(page: Page, name: string, code: string): Promise<void> {
  await page.getByRole("link", { name: "Додати картку" }).click();
  await page.getByRole("button", { name: "Ввести код руками" }).click();

  await page.getByLabel("Назва").fill(name);
  await page.getByLabel("Код", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Зберегти" }).click();
}

/**
 * Перетягування пальцем.
 *
 * Playwright уміє з дотиків лише `tap`, тож справжня послідовність
 * touchstart/touchmove/touchend надсилається напряму через протокол.
 * Обходитися мишею тут не можна: саме на дотиках і ламалося перетягування —
 * браузер віддавав жест гортанню сторінки, — а миша цієї відмінності не
 * відтворює взагалі.
 */
export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: { holdMs?: number; steps?: number } = {},
): Promise<void> {
  const { holdMs = 400, steps = 10 } = options;
  const cdp = await page.context().newCDPSession(page);

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });

  // Утримання — частина жесту, а не хитрість для стабільності тесту:
  // перетягування навмисно починається лише після нього.
  await page.waitForTimeout(holdMs);

  for (let step = 1; step <= steps; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps,
        },
      ],
    });
  }

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Середина елемента у координатах екрана. */
export async function centerOf(
  page: Page,
  name: RegExp,
): Promise<{ x: number; y: number }> {
  const box = await page.getByRole("button", { name }).boundingBox();
  if (!box) throw new Error(`Не знайшлося на екрані: ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
