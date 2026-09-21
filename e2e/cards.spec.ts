import { expect, test } from "@playwright/test";
import { addCard } from "./helpers";

test("картка додається й показує штрихкод", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Поки порожньо")).toBeVisible();

  await addCard(page, "Сільпо", "4006381333931");

  // Після збереження застосунок одразу показує саму картку — саме те, заради
  // чого її додавали.
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
  await expect(page.getByText("4006381333931")).toBeVisible();

  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("button", { name: /Сільпо/ })).toBeVisible();
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
