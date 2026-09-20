import { expect, test, type Page } from "@playwright/test";

/**
 * Головний сценарій застосунку: додати картку й показати її касиру.
 *
 * Сканер тут не використовується навмисно — камери в тестовому браузері немає,
 * і це добре відтворює реальну ситуацію, коли доступ до камери заборонений.
 * Застосунок має лишатися повністю придатним і в такому стані.
 */
async function addCard(page: Page, name: string, code: string) {
  await page.getByRole("link", { name: "Додати картку" }).click();

  // Сканер відкривається одразу; без дозволу на камеру він показує помилку
  // й кнопку ручного введення.
  await page.getByRole("button", { name: "Ввести код руками" }).click();

  await page.getByLabel("Назва").fill(name);
  await page.getByLabel("Код", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Зберегти" }).click();
}

test("картка додається й показує штрихкод", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Поки порожньо")).toBeVisible();

  await addCard(page, "Сільпо", "4006381333931");

  // Після збереження застосунок одразу показує саму картку — саме те, заради
  // чого її додавали.
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
  await expect(page.getByText("4006381333931")).toBeVisible();

  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page.getByRole("link", { name: /Сільпо/ })).toBeVisible();
});

test("помилковий номер видно ще до збереження", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Додати картку" }).click();
  await page.getByRole("button", { name: "Ввести код руками" }).click();

  await page.getByLabel("Назва").fill("Аптека");
  await page.getByLabel("Тип коду").selectOption("ean_13");
  await page.getByLabel("Код", { exact: true }).fill("4006381333932");

  await expect(page.getByText(/контрольна цифра/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Зберегти" })).toBeDisabled();
});

test("картка відкривається з двох дотиків і запам'ятовує, що нею користувалися", async ({
  page,
}) => {
  await page.goto("/");
  await addCard(page, "Сільпо", "4006381333931");
  await page.getByRole("link", { name: "Назад" }).click();
  await addCard(page, "АТБ", "5901234123457");
  await page.getByRole("link", { name: "Назад" }).click();

  // Остання відкрита картка стає першою в списку.
  const tiles = page.getByRole("link").filter({ hasText: /Сільпо|АТБ/ });
  await expect(tiles.first()).toContainText("АТБ");

  await tiles.filter({ hasText: "Сільпо" }).click();
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();

  await page.getByRole("link", { name: "Назад" }).click();
  await expect(tiles.first()).toContainText("Сільпо");
});

test("картку можна перейменувати й видалити", async ({ page }) => {
  await page.goto("/");
  await addCard(page, "Було", "4006381333931");

  await page.getByRole("link", { name: "Змінити картку" }).click();
  await page.getByLabel("Назва").fill("Стало");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByText("Стало")).toBeVisible();

  await page.getByRole("link", { name: "Змінити картку" }).click();
  await page.getByRole("button", { name: "Видалити картку" }).click();
  await page.getByRole("button", { name: "Так, видалити" }).click();

  await expect(page.getByText("Поки порожньо")).toBeVisible();
});
