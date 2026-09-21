import type { BarcodeFormat } from "./barcodeFormats";

/**
 * Картка лояльності — єдина сутність застосунку.
 *
 * Поля `updatedAt` та `deletedAt` потрібні не сьогоднішньому застосунку, а
 * завтрашньому: доки все живе на одному пристрої, вони просто заповнюються.
 * Але саме вони дозволять колись домалювати синхронізацію між пристроями, не
 * чіпаючи вже збережені в юзерів дані — а мігрувати чужу базу в браузері
 * значно дорожче, ніж одразу тримати два зайвих числа.
 */
export type Card = {
  /** UUID, а не автоінкремент: інкремент неможливо злити з двох пристроїв. */
  id: string;
  name: string;
  /** Те, що насправді читає сканер каси. */
  code: string;
  format: BarcodeFormat;
  /** Колір плитки в списку — головна прикмета, за якою картку впізнають. */
  color: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Позначка видалення замість справжнього стирання рядка: видалену картку
   * колись треба буде донести до інших пристроїв. `0` — картка жива.
   */
  deletedAt: number;
  /**
   * Місце картки в списку. Порядок задає юзер перетягуванням і більше ніщо:
   * список, який сам собі змінює вигляд, доводиться щоразу перечитувати очима,
   * а сталий запам'ятовується рукою — до потрібної картки з часом тягнешся, не
   * дивлячись.
   *
   * Числа лише впорядковують і не зобов'язані йти поспіль: важливо, що менше
   * стоїть вище.
   */
  position: number;
};

/** Фотографії лежать окремо від картки — див. коментар у `db.ts`. */
export type CardPhotos = {
  cardId: string;
  front?: Blob;
  back?: Blob;
};

export type CardDraft = {
  name: string;
  code: string;
  format: BarcodeFormat;
  color: string;
  note: string;
};

/**
 * Палітра плиток.
 *
 * Кольори підібрані так, щоб на них читався чорний текст і щоб сусідні в
 * списку помітно відрізнялися навіть краєм ока — картку шукають поглядом,
 * а не читанням назв.
 */
export const CARD_COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#e4e4e7",
] as const;

/** Колір для нової картки — щоб сусідні плитки не виходили однаковими. */
export function nextColor(usedColors: readonly string[]): string {
  const unused = CARD_COLORS.find((color) => !usedColors.includes(color));
  return unused ?? CARD_COLORS[usedColors.length % CARD_COLORS.length];
}

/**
 * Ініціали для плитки без фотографії: одна-дві літери, які видно з відстані
 * витягнутої руки. Беремо перші літери перших двох слів назви.
 */
export function cardInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
