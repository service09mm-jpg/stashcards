import { beforeEach, describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup, restoreBackup } from "./backup";
import {
  createCard,
  db,
  deleteCard,
  getPhotos,
  listCards,
  reorderCards,
  setPhoto,
  updateCard,
} from "./db";

const draft = (name: string) => ({
  name,
  code: "4006381333931",
  format: "ean_13" as const,
  color: "#60a5fa",
  note: "",
});

/** Копія так, як її побачить юзер: через файл, а не через об'єкт у пам'яті. */
async function roundTrip(): Promise<string> {
  return JSON.stringify(await createBackup());
}

async function restoreFrom(json: string) {
  const parsed = parseBackup(json);
  if ("error" in parsed) throw new Error(parsed.error);
  return restoreBackup(parsed.cards);
}

beforeEach(async () => {
  await db.cards.clear();
  await db.photos.clear();
});

describe("копія й відновлення", () => {
  it("повертає картки на порожній пристрій", async () => {
    await createCard(draft("Сільпо"));
    await createCard(draft("АТБ"));
    const file = await roundTrip();

    await db.cards.clear();
    const report = await restoreFrom(file);

    expect(report).toEqual({ added: 2, updated: 0, skipped: 0 });
    expect((await listCards()).map((card) => card.name).sort()).toEqual(["АТБ", "Сільпо"]);
  });

  it("зберігає фотографії разом із карткою", async () => {
    const card = await createCard(draft("З фото"));
    await setPhoto(card.id, "front", new Blob(["знімок"], { type: "image/jpeg" }));
    const file = await roundTrip();

    await db.cards.clear();
    await db.photos.clear();
    await restoreFrom(file);

    const photos = await getPhotos(card.id);
    expect(await photos?.front?.text()).toBe("знімок");
    expect(photos?.front?.type).toBe("image/jpeg");
  });

  it("не плодить дублікатів, скільки б разів копію не вливали", async () => {
    await createCard(draft("Сільпо"));
    const file = await roundTrip();

    await restoreFrom(file);
    await restoreFrom(file);

    expect(await listCards()).toHaveLength(1);
  });

  it("не затирає новішу версію картки старішою з копії", async () => {
    const card = await createCard(draft("Було"));
    const file = await roundTrip();

    await updateCard(card.id, { name: "Стало" });
    const report = await restoreFrom(file);

    expect(report.skipped).toBe(1);
    expect((await listCards())[0].name).toBe("Стало");
  });

  it("оновлює картку, якщо в копії вона новіша", async () => {
    const card = await createCard(draft("Було"));
    await updateCard(card.id, { name: "Стало" });
    const file = await roundTrip();

    // Повертаємо на пристрої стару версію — так виглядав би старіший телефон.
    await db.cards.update(card.id, { name: "Було", updatedAt: card.updatedAt - 1000 });
    const report = await restoreFrom(file);

    expect(report.updated).toBe(1);
    expect((await listCards())[0].name).toBe("Стало");
  });

  it("не тягне в копію видалені картки", async () => {
    const card = await createCard(draft("Зайва"));
    await createCard(draft("Потрібна"));
    await deleteCard(card.id);

    const backup = await createBackup();

    expect(backup.cards.map((item) => item.name)).toEqual(["Потрібна"]);
  });
});

describe("копія й порядок карток", () => {
  it("переносить порядок, заданий юзером", async () => {
    const first = await createCard(draft("Перша"));
    const second = await createCard(draft("Друга"));
    await reorderCards([second.id, first.id]);
    const file = await roundTrip();

    await db.cards.clear();
    await restoreFrom(file);

    expect((await listCards()).map((card) => card.name)).toEqual(["Друга", "Перша"]);
  });

  it("ставить у кінець картки з копії, зробленої до появи порядку", async () => {
    await createCard(draft("Своя"));

    // Так виглядає файл, збережений старішою версією застосунку.
    const old = JSON.stringify({
      app: "stashcards",
      version: 1,
      exportedAt: Date.now(),
      cards: [
        {
          id: "стара-картка",
          name: "Зі старої копії",
          code: "5901234123457",
          format: "ean_13",
          color: "#f472b6",
          note: "",
          createdAt: 1,
          updatedAt: 1,
          lastUsedAt: 0,
          usageCount: 7,
        },
      ],
    });

    await restoreFrom(old);

    expect((await listCards()).map((card) => card.name)).toEqual([
      "Своя",
      "Зі старої копії",
    ]);
  });

  it("не тягне в базу полів, яких у застосунку вже немає", async () => {
    const old = JSON.stringify({
      app: "stashcards",
      version: 1,
      exportedAt: Date.now(),
      cards: [
        {
          id: "стара-картка",
          name: "Зі старої копії",
          code: "5901234123457",
          format: "ean_13",
          color: "#f472b6",
          note: "",
          createdAt: 1,
          updatedAt: 1,
          lastUsedAt: 123,
          usageCount: 7,
        },
      ],
    });

    await restoreFrom(old);

    const [restored] = await listCards();
    expect(restored).not.toHaveProperty("usageCount");
    expect(restored).not.toHaveProperty("lastUsedAt");
  });
});

describe("читання чужого або поламаного файла", () => {
  it("відмовляє, якщо всередині не JSON", () => {
    expect(parseBackup("не json")).toEqual({
      error: expect.stringContaining("JSON"),
    });
  });

  it("відмовляє, якщо файл створений іншим застосунком", () => {
    expect(parseBackup(JSON.stringify({ app: "wallet", cards: [] }))).toEqual({
      error: expect.stringContaining("не цим застосунком"),
    });
  });

  it("відмовляє, якщо формат новіший за той, який розуміємо", () => {
    const fromFuture = JSON.stringify({ app: "stashcards", version: 99, cards: [] });

    expect(parseBackup(fromFuture)).toEqual({
      error: expect.stringContaining("новішою версією"),
    });
  });

  it("рятує вцілілі картки й мовчки відкидає поламані", async () => {
    await createCard(draft("Ціла"));
    const backup = JSON.parse(await roundTrip());
    backup.cards.push({ id: "поламана", name: "Без коду" });

    const parsed = parseBackup(JSON.stringify(backup));

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.cards).toHaveLength(1);
  });
});

describe("ім'я файла копії", () => {
  it("містить дату — щоб кілька копій у теці не зливалися в одну", () => {
    expect(backupFileName(new Date("2026-03-14T10:00:00Z"))).toBe(
      "stashcards-2026-03-14.json",
    );
  });
});
