import { beforeEach, describe, expect, it } from "vitest";
import {
  createCard,
  db,
  deleteCard,
  getCard,
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

beforeEach(async () => {
  await db.cards.clear();
  await db.photos.clear();
});

const names = async () => (await listCards()).map((card) => card.name);

describe("порядок списку", () => {
  it("зберігає порядок, у якому картки додали", async () => {
    await createCard(draft("Перша"));
    await createCard(draft("Друга"));
    await createCard(draft("Третя"));

    expect(await names()).toEqual(["Перша", "Друга", "Третя"]);
  });

  it("ставить нову картку в кінець, не зсуваючи розставлене", async () => {
    await createCard(draft("Перша"));
    await createCard(draft("Друга"));

    await createCard(draft("Третя"));

    expect(await names()).toEqual(["Перша", "Друга", "Третя"]);
  });

  it("не змінює порядок від того, що картку відкривали", async () => {
    const first = await createCard(draft("Перша"));
    await createCard(draft("Друга"));

    // Саме цього юзер і просив: відкриття картки більше ні на що не впливає.
    await getCard(first.id);
    await getCard(first.id);

    expect(await names()).toEqual(["Перша", "Друга"]);
  });
});

describe("перестановка карток", () => {
  it("запам'ятовує порядок, заданий юзером", async () => {
    const first = await createCard(draft("Перша"));
    const second = await createCard(draft("Друга"));
    const third = await createCard(draft("Третя"));

    await reorderCards([third.id, first.id, second.id]);

    expect(await names()).toEqual(["Третя", "Перша", "Друга"]);
  });

  it("позначає зміненими лише ті картки, що справді переїхали", async () => {
    const first = await createCard(draft("Перша"));
    const second = await createCard(draft("Друга"));
    const third = await createCard(draft("Третя"));

    // Відсуваємо час останньої зміни далеко в минуле: інакше «до» і «після»
    // могли б припасти на ту саму мілісекунду й тест нічого не перевіряв би.
    const longAgo = 1_000;
    for (const card of [first, second, third]) {
      await db.cards.update(card.id, { updatedAt: longAgo });
    }

    // Міняємо місцями перші дві: третя лишається там, де й була.
    await reorderCards([second.id, first.id, third.id]);

    expect((await getCard(third.id))?.updatedAt).toBe(longAgo);
    expect((await getCard(first.id))?.updatedAt).toBeGreaterThan(longAgo);
  });

  it("переживає порядок із неіснуючою карткою", async () => {
    const first = await createCard(draft("Перша"));
    const second = await createCard(draft("Друга"));

    await reorderCards([second.id, "картки-з-таким-id-немає", first.id]);

    expect(await names()).toEqual(["Друга", "Перша"]);
  });

  it("не воскрешає видалену картку", async () => {
    const first = await createCard(draft("Перша"));
    const second = await createCard(draft("Друга"));
    await deleteCard(second.id);

    await reorderCards([second.id, first.id]);

    expect(await names()).toEqual(["Перша"]);
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

});

describe("зміни", () => {
  it("посуває updatedAt, щоб майбутня синхронізація бачила новішу версію", async () => {
    const card = await createCard(draft("Було"));

    await updateCard(card.id, { name: "Стало" });

    const changed = await getCard(card.id);
    expect(changed?.name).toBe("Стало");
    expect(changed?.updatedAt).toBeGreaterThanOrEqual(card.updatedAt);
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
