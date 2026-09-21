import { expect, test, type Page } from "@playwright/test";
import { addCard } from "./helpers";

/**
 * Порядок карток задає юзер і тільки юзер.
 *
 * Раніше список сортувався сам, за частотою використання, і це виявилося
 * гіршим за сталий порядок: список, який щоразу виглядає інакше, доводиться
 * перечитувати очима.
 */
async function tileNames(page: Page): Promise<string[]> {
  return page.getByTestId("card-tile").allTextContents();
}

test("порядок не змінюється від того, що картку відкривали", async ({ page }) => {
  await page.goto("/");
  await addCard(page, "Перша", "4006381333931");
  await page.getByRole("button", { name: "Назад" }).click();
  await addCard(page, "Друга", "5901234123457");
  await page.getByRole("button", { name: "Назад" }).click();

  await expect(page.getByTestId("card-tile")).toHaveCount(2);

  // Відкриваємо другу картку двічі — раніше вона б від цього піднялася вгору.
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole("button", { name: /Друга/ }).click();
    await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
    await page.getByRole("button", { name: "Назад" }).click();
  }

  const names = await tileNames(page);
  expect(names[0]).toContain("Перша");
  expect(names[1]).toContain("Друга");
});

test("картку можна перетягнути на інше місце", async ({ page }) => {
  await page.goto("/");
  await addCard(page, "Перша", "4006381333931");
  await page.getByRole("button", { name: "Назад" }).click();
  await addCard(page, "Друга", "5901234123457");
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByTestId("card-tile")).toHaveCount(2);

  const source = page.getByRole("button", { name: /Друга/ });
  const target = page.getByRole("button", { name: /Перша/ });
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Плитки не знайшлися на екрані");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Очікування тут по суті справи, а не для стабільності: перетягування
  // навмисно починається лише після утримання, щоб не заважати звичайному
  // дотику й гортанню списку.
  await page.waitForTimeout(400);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect
    .poll(async () => (await tileNames(page))[0])
    .toContain("Друга");

  // Перетягування не має відкривати картку: відкладений `click` по
  // посиланню гаситься.
  await expect(page).toHaveURL(/\/$/);

  // І новий порядок має пережити перезавантаження — він у базі, а не в пам'яті.
  await page.reload();
  await expect(page.getByTestId("card-tile")).toHaveCount(2);
  const names = await tileNames(page);
  expect(names[0]).toContain("Друга");
  expect(names[1]).toContain("Перша");
});
