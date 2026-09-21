import Dexie, { type Table } from "dexie";
import type { Card, CardDraft, CardPhotos } from "./card";

/**
 * Сховище застосунку — IndexedDB через Dexie.
 *
 * Жодного сервера за цим немає й не передбачається: картка лояльності — це по
 * суті номер, який не має причин кудись їхати. Як наслідок, застосунок працює
 * офлайн не «завдяки кешу», а тому що мережа йому взагалі не потрібна.
 */

const db = new Dexie("stashcards") as Dexie & {
  cards: Table<Card, string>;
  photos: Table<CardPhotos, string>;
};

/*
  Фотографії винесені в окрему таблицю навмисно. IndexedDB читає рядок цілком,
  тож якби знімки лежали всередині картки, побудова списку тягла б з диска
  кілька мегабайтів блобів заради назв і кольорів. Список — найчастіша
  операція в застосунку, і він має лишатися миттєвим.

  В індексах лише те, за чим справді шукаємо: порядок списку (`position`),
  відсів видалених (`deletedAt`) і майбутня синхронізація (`updatedAt`).
*/
db.version(1).stores({
  cards: "id, lastUsedAt, updatedAt, deletedAt",
  photos: "cardId",
});

/*
  Друга версія прибирає автоматичне сортування за частотою використання й
  віддає порядок юзеру.

  Перехід переносить той порядок, який людина бачила перед оновленням, у
  ручний: картки нумеруються так, як вони стояли востаннє. Інакше після
  оновлення застосунку список одного ранку перетасувався б сам — рівно те, від
  чого ця зміна й позбавляє.
*/
db.version(2)
  .stores({ cards: "id, position, updatedAt, deletedAt" })
  .upgrade(async (tx) => {
    type LegacyCard = Card & { lastUsedAt?: number; usageCount?: number };

    const table = tx.table<LegacyCard, string>("cards");
    const rows = await table.toArray();
    rows.sort(
      (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || b.createdAt - a.createdAt,
    );

    for (const [index, row] of rows.entries()) {
      // Лічильники використання свідомо не переносяться: нічого в застосунку
      // їх більше не читає, а мовчки збирати статистику, яка нікому не
      // потрібна, — не те, чого чекають від застосунку без сервера.
      const { lastUsedAt: _lastUsedAt, usageCount: _usageCount, ...rest } = row;
      await table.put({ ...rest, position: index });
    }
  });

export { db };

/** `crypto.randomUUID` є лише в захищеному контексті — звідси запасний шлях. */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Список карток у порядку, який задав юзер.
 *
 * Сортування робиться в пам'яті, а не запитом за індексом, навмисно: карток
 * десятки, різниці в швидкості немає, зате видимий порядок повністю описаний
 * ось цим одним рядком, який не розходиться з тим, що зберігає `reorderCards`.
 */
export async function listCards(): Promise<Card[]> {
  const alive = await db.cards.where("deletedAt").equals(0).toArray();
  return alive.sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
}

/**
 * Картка за ідентифікатором, або `null`, якщо її немає чи вона видалена.
 *
 * Саме `null`, а не `undefined`: `undefined` у Dexie означає «запит ще
 * виконується», і екрану картки потрібно відрізняти «ще читаємо» від «такої
 * картки немає» — у другому випадку він повертає юзера до списку.
 */
export async function getCard(id: string): Promise<Card | null> {
  const card = await db.cards.get(id);
  return card && card.deletedAt === 0 ? card : null;
}

export async function createCard(draft: CardDraft): Promise<Card> {
  const now = Date.now();
  // Нова картка стає в кінець списку. Ставити її першою означало б щоразу
  // зсувати все, що юзер уже розставив, — а розставляв він саме для того, щоб
  // нічого не рухалося.
  const last = await db.cards.orderBy("position").last();

  const card: Card = {
    id: newId(),
    ...draft,
    createdAt: now,
    updatedAt: now,
    deletedAt: 0,
    position: last ? last.position + 1 : 0,
  };
  await db.cards.add(card);
  return card;
}

/**
 * Новий порядок списку.
 *
 * На вхід іде повний перелік живих карток так, як вони тепер мають стояти.
 * Записуються тільки ті, чиє місце справді змінилося: після перетягування
 * однієї картки решта переважно лишається на місці, і переписувати весь
 * список означало б без потреби позначити кожну картку як змінену — а
 * `updatedAt` колись вирішуватиме конфлікти синхронізації.
 */
export async function reorderCards(orderedIds: readonly string[]): Promise<void> {
  const now = Date.now();

  await db.transaction("rw", db.cards, async () => {
    for (const [position, id] of orderedIds.entries()) {
      const card = await db.cards.get(id);
      if (!card || card.deletedAt !== 0 || card.position === position) continue;
      await db.cards.update(id, { position, updatedAt: now });
    }
  });
}

export async function updateCard(
  id: string,
  patch: Partial<CardDraft>,
): Promise<void> {
  await db.cards.update(id, { ...patch, updatedAt: Date.now() });
}

/**
 * Видалення картки.
 *
 * Сам рядок лишається — стирається тільки вміст і фотографії. Так видалення
 * можна буде колись повторити на інших пристроях: рядок, якого немає, нічим
 * не відрізняється від рядка, який ще не приїхав.
 */
export async function deleteCard(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.cards, db.photos, async () => {
    await db.cards.update(id, { deletedAt: now, updatedAt: now });
    await db.photos.delete(id);
  });
}

export async function getPhotos(cardId: string): Promise<CardPhotos | undefined> {
  return db.photos.get(cardId);
}

export async function setPhoto(
  cardId: string,
  side: "front" | "back",
  photo: Blob | undefined,
): Promise<void> {
  await db.transaction("rw", db.cards, db.photos, async () => {
    const existing = (await db.photos.get(cardId)) ?? { cardId };
    const next: CardPhotos = { ...existing, [side]: photo };
    if (!next.front && !next.back) {
      await db.photos.delete(cardId);
    } else {
      await db.photos.put(next);
    }
    await db.cards.update(cardId, { updatedAt: Date.now() });
  });
}

/**
 * Прохання до браузера не викидати наші дані.
 *
 * Без цього сховище вважається тимчасовим, і система має право стерти його,
 * коли на пристрої закінчується місце. Браузер може й відмовити — тоді
 * єдиний надійний захист даних це резервна копія, і саме тому експорт у
 * застосунку не додаткова можливість, а обов'язкова частина.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
