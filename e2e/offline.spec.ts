import { expect, test } from "@playwright/test";

/**
 * Найважливіша перевірка в застосунку.
 *
 * Уся його цінність — у тому, що картка відкривається там, де інтернету
 * немає: у підвальному магазині, в роумінгу, в літаку. Якщо цей тест
 * проходить, застосунок робить свою роботу; якщо ні — решта не має значення.
 */
test("картка відкривається без мережі", async ({ page, context }) => {
  await page.goto("/");

  // Чекаємо, доки service worker складе всі файли застосунку до кешу.
  await page.evaluate(() => navigator.serviceWorker.ready);

  await page.getByRole("link", { name: "Додати картку" }).click();
  await page.getByRole("button", { name: "Ввести код руками" }).click();
  await page.getByLabel("Назва").fill("Сільпо");
  await page.getByLabel("Код", { exact: true }).fill("4006381333931");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  // Застосунок піднявся з кешу, картка — з бази браузера, а штрихкод
  // намальований тут же, на пристрої.
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
  await expect(page.getByText("4006381333931")).toBeVisible();

  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page.getByRole("link", { name: /Сільпо/ })).toBeVisible();
});

test("нову картку можна додати без мережі", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();

  await page.getByRole("link", { name: "Додати картку" }).click();
  await page.getByRole("button", { name: "Ввести код руками" }).click();
  await page.getByLabel("Назва").fill("Аптека");
  await page.getByLabel("Код", { exact: true }).fill("5901234123457");
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
});
