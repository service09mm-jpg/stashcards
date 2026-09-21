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
