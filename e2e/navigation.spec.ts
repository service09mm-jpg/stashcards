import { expect, test } from "@playwright/test";
import { addCard } from "./helpers";

/**
 * Поведінка кнопки «назад» — і екранної, і системної.
 *
 * Тут був справжній баг: кнопка «назад» вела на головну звичайним посиланням,
 * тобто *додавала* запис в історію замість того, щоб зняти. Після десятка
 * відкритих карток системна кнопка на Android поводилася відповідно — замість
 * вийти із застосунку вона вела назад по всіх переглянутих картках по черзі.
 */
test("системне «назад» не веде по вже закритих картках", async ({ page }) => {
  await page.goto("/");
  await addCard(page, "Перша", "4006381333931");
  await page.getByRole("button", { name: "Назад" }).click();
  await addCard(page, "Друга", "5901234123457");
  await page.getByRole("button", { name: "Назад" }).click();

  // Відкриваємо й закриваємо картки кілька разів поспіль — саме так історія
  // раніше й розросталася.
  for (const name of [/Перша/, /Друга/, /Перша/]) {
    await page.getByRole("button", { name }).click();
    await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page.getByTestId("card-tile").first()).toBeVisible();
  }

  await page.goBack();

  // Зі списку системне «назад» виходить із застосунку, а не показує чергову
  // раніше відкриту картку.
  expect(page.url()).not.toContain("/card/");
});

test("«назад» із картки, відкритої за посиланням, веде до списку", async ({ page }) => {
  await page.goto("/");
  await addCard(page, "Сільпо", "4006381333931");
  // Адресу знімаємо тільки після того, як картка справді відкрилася: перехід
  // після збереження відбувається в браузері й не миттєво.
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();
  const cardUrl = page.url();

  // Окрема вкладка — щоб картка була першим записом в історії, як при
  // переході за надісланим посиланням.
  await page.goto("about:blank");
  await page.goto(cardUrl);
  await expect(page.getByTestId("barcode").locator("svg")).toBeVisible();

  await page.getByRole("button", { name: "Назад" }).click();

  await expect(page.getByRole("button", { name: /Сільпо/ })).toBeVisible();
});

test("«назад» із налаштувань повертає до списку, а не поглиблює історію", async ({
  page,
}) => {
  await page.goto("/");
  await addCard(page, "Сільпо", "4006381333931");
  await page.getByRole("button", { name: "Назад" }).click();

  await page.getByRole("link", { name: "Налаштування" }).click();
  await expect(page.getByRole("heading", { name: "Налаштування" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("button", { name: /Сільпо/ })).toBeVisible();

  await page.goBack();

  expect(page.url()).not.toContain("/settings");
});

test("після правки картки «назад» веде до списку, а не до неї ж", async ({ page }) => {
  await page.goto("/");
  await addCard(page, "Було", "4006381333931");

  await page.getByRole("link", { name: "Змінити картку" }).click();
  await page.getByLabel("Назва").fill("Стало");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByText("Стало")).toBeVisible();

  // Збереження знімає з історії екран правки, а не кладе ще одну копію
  // картки поверх нього.
  await page.getByRole("button", { name: "Назад" }).click();

  await expect(page.getByRole("button", { name: /Стало/ })).toBeVisible();
});
