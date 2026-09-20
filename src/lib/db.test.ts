import { beforeEach, describe, expect, it } from "vitest";
import {
  createCard,
  db,
  deleteCard,
  getCard,
  getPhotos,
  listCards,
  setPhoto,
  touchCard,
  updateCard,
} from "./db";

const draft = (name: string) => ({
  name,
  code: "4006381333931",
  format: "ean_13" as const,
  color: "#60a5fa",
  note: "",
});

beforeEach(async () => {
  await db.cards.clear();
  await db.photos.clear();
});

describe("список карток", () => {
  it("ставить першою ту, якою користувалися востаннє", async () => {
    const silpo = await createCard(draft("Сільпо"));
    const atb = await createCard(draft("АТБ"));

    await touchCard(silpo.id);
    await touchCard(atb.id);

    const names = (await listCards()).map((card) => card.name);
    expect(names).toEqual(["АТБ", "Сільпо"]);
  });

  it("ставить ще не вживані картки після вживаних, новіші вище", async () => {
    const old = await createCard(draft("Стара"));
    await createCard(draft("Нова"));
    await touchCard(old.id);

    const names = (await listCards()).map((card) => card.name);
    expect(names).toEqual(["Стара", "Нова"]);
  });

  it("рахує, скільки разів картку показували", async () => {
    const card = await createCard(draft("Аптека"));

    await touchCard(card.id);
    await touchCard(card.id);

    expect((await getCard(card.id))?.usageCount).toBe(2);
  });
});

describe("видалення", () => {
  it("прибирає картку зі списку", async () => {
    const card = await createCard(draft("Зайва"));

    await deleteCard(card.id);

    expect(await listCards()).toHaveLength(0);
    expect(await getCard(card.id)).toBeNull();
  });

  it("лишає слід у базі — він знадобиться для синхронізації", async () => {
    const card = await createCard(draft("Зайва"));

    await deleteCard(card.id);

    const row = await db.cards.get(card.id);
    expect(row?.deletedAt).toBeGreaterThan(0);
  });

  it("забирає з собою фотографії", async () => {
    const card = await createCard(draft("З фото"));
    await setPhoto(card.id, "front", new Blob(["x"], { type: "image/jpeg" }));

    await deleteCard(card.id);

    expect(await getPhotos(card.id)).toBeUndefined();
  });

  it("не воскрешає видалену картку при показі", async () => {
    const card = await createCard(draft("Зайва"));
    await deleteCard(card.id);

    await touchCard(card.id);

    expect(await listCards()).toHaveLength(0);
  });
});

describe("зміни", () => {
  it("посуває updatedAt, щоб майбутня синхронізація бачила новішу версію", async () => {
    const card = await createCard(draft("Було"));

    await updateCard(card.id, { name: "Стало" });

    const changed = await getCard(card.id);
    expect(changed?.name).toBe("Стало");
    expect(changed?.updatedAt).toBeGreaterThanOrEqual(card.updatedAt);
  });

  it("не рахує показ картки за її зміну", async () => {
    const card = await createCard(draft("Сільпо"));

    await touchCard(card.id);

    // Показ змінює лише порядок у списку. Якби він чіпав `updatedAt`, кожне
    // відкриття картки виглядало б для синхронізації як правка.
    expect((await getCard(card.id))?.updatedAt).toBe(card.updatedAt);
  });
});

describe("фотографії", () => {
  it("зберігає обидва боки окремо", async () => {
    const card = await createCard(draft("З фото"));

    await setPhoto(card.id, "front", new Blob(["front"], { type: "image/jpeg" }));
    await setPhoto(card.id, "back", new Blob(["back"], { type: "image/jpeg" }));

    const photos = await getPhotos(card.id);
    expect(await photos?.front?.text()).toBe("front");
    expect(await photos?.back?.text()).toBe("back");
  });

  it("прибирає рядок, коли не лишилося жодного знімка", async () => {
    const card = await createCard(draft("З фото"));
    await setPhoto(card.id, "front", new Blob(["x"]));

    await setPhoto(card.id, "front", undefined);

    expect(await getPhotos(card.id)).toBeUndefined();
  });
});
