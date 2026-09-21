import Dexie from "dexie";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Перехід зі старої бази на нову.
 *
 * Перевірка не теоретична: у юзера на телефоні вже лежить база першої версії,
 * зібрана за час, поки список сортувався сам. Оновлення застосунку не має
 * перетасувати їй картки — людина звикла бачити їх у тому порядку, у якому
 * бачила вчора.
 *
 * База готується сирим Dexie зі старою схемою *до* того, як завантажиться
 * `db.ts`: модуль відкриває з'єднання одразу при імпорті, тож інакше перехід
 * стався б раніше, ніж у базі з'явилися б дані.
 */
type LegacyCard = {
  id: string;
  name: string;
  code: string;
  format: string;
  color: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  lastUsedAt: number;
  usageCount: number;
};

const legacy = (id: string, name: string, lastUsedAt: number, createdAt: number): LegacyCard => ({
  id,
  name,
  code: "4006381333931",
  format: "ean_13",
  color: "#60a5fa",
  note: "",
  createdAt,
  updatedAt: createdAt,
  deletedAt: 0,
  lastUsedAt,
  usageCount: 0,
});

let listCards: typeof import("./db").listCards;

beforeAll(async () => {
  const old = new Dexie("stashcards");
  old.version(1).stores({
    cards: "id, lastUsedAt, updatedAt, deletedAt",
    photos: "cardId",
  });
  await old.open();
  await old.table<LegacyCard>("cards").bulkAdd([
    // Порядок, який юзер бачив перед оновленням: спершу свіжіші за
    // використанням, далі — ті, яких не відкривали, новіші вище.
    legacy("a", "Рідко", 0, 300),
    legacy("b", "Часто", 900, 100),
    legacy("c", "Не відкривали", 0, 200),
    legacy("d", "Давно", 500, 400),
  ]);
  old.close();

  ({ listCards } = await import("./db"));
});

describe("перехід на ручний порядок", () => {
  it("лишає картки там, де юзер бачив їх до оновлення", async () => {
    expect((await listCards()).map((card) => card.name)).toEqual([
      "Часто",
      "Давно",
      "Рідко",
      "Не відкривали",
    ]);
  });

  it("нумерує картки поспіль, щоб їх можна було переставляти далі", async () => {
    expect((await listCards()).map((card) => card.position)).toEqual([0, 1, 2, 3]);
  });

  it("прибирає лічильники використання, які більше нікому не потрібні", async () => {
    const [first] = await listCards();

    expect(first).not.toHaveProperty("lastUsedAt");
    expect(first).not.toHaveProperty("usageCount");
  });
});
