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

  В індексах лише те, за чим справді шукаємо: сортування списку (`lastUsedAt`),
  відсів видалених (`deletedAt`) і майбутня синхронізація (`updatedAt`).
*/
db.version(1).stores({
  cards: "id, lastUsedAt, updatedAt, deletedAt",
  photos: "cardId",
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
 * Список карток: спершу ті, якими користувалися востаннє.
 *
 * Це головна оптимізація всього застосунку. У більшості людей є дві-три
 * картки, якими вони користуються постійно, і десяток забутих. Сортування за
 * останнім використанням ставить потрібну першою, тож шлях від іконки до
 * штрихкоду — два дотики й жодного пошуку очима.
 */
export async function listCards(): Promise<Card[]> {
  const alive = await db.cards.where("deletedAt").equals(0).toArray();
  return alive.sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.createdAt - a.createdAt);
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
  const card: Card = {
    id: newId(),
    ...draft,
    createdAt: now,
    updatedAt: now,
    deletedAt: 0,
    lastUsedAt: 0,
    usageCount: 0,
  };
  await db.cards.add(card);
  return card;
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

/**
 * Відмітка про використання картки. Викликається, коли штрихкод показали на
 * екрані, — саме з неї й береться порядок у списку.
 */
export async function touchCard(id: string): Promise<void> {
  const card = await db.cards.get(id);
  if (!card || card.deletedAt !== 0) return;
  await db.cards.update(id, {
    lastUsedAt: Date.now(),
    usageCount: card.usageCount + 1,
    // `updatedAt` навмисно не чіпаємо: показ картки — не зміна її вмісту, і
    // майбутній синхронізації нема чого через це прокидатися.
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
