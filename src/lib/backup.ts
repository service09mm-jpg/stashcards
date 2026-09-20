import { BARCODE_FORMATS, type BarcodeFormat } from "./barcodeFormats";
import type { Card } from "./card";
import { db } from "./db";

/**
 * Резервна копія.
 *
 * Це не додаткова зручність, а обов'язкова частина застосунку. Дані живуть
 * лише в браузері: видалення іконки з екрана на iPhone стирає їх без
 * попередження й без кошика, те саме робить «очистити дані сайту». Поки
 * синхронізації немає, єдине, що стоїть між юзером і втратою всіх карток, —
 * ось цей файл.
 *
 * Формат навмисно простий і читабельний: звичайний JSON, який можна
 * відкрити очима й, за потреби, полагодити руками.
 */

const FORMAT_VERSION = 1;
const SIGNATURE = "stashcards";

type BackupPhoto = string; // data:-посилання

export type BackupCard = Omit<Card, "deletedAt"> & {
  photos?: { front?: BackupPhoto; back?: BackupPhoto };
};

export type Backup = {
  app: typeof SIGNATURE;
  version: number;
  exportedAt: number;
  cards: BackupCard[];
};

export async function createBackup(): Promise<Backup> {
  const cards = await db.cards.where("deletedAt").equals(0).toArray();
  const backupCards: BackupCard[] = [];

  for (const card of cards) {
    const { deletedAt: _deletedAt, ...rest } = card;
    const stored = await db.photos.get(card.id);
    const photos: { front?: BackupPhoto; back?: BackupPhoto } = {};
    if (stored?.front) photos.front = await blobToDataUrl(stored.front);
    if (stored?.back) photos.back = await blobToDataUrl(stored.back);

    backupCards.push(
      Object.keys(photos).length > 0 ? { ...rest, photos } : rest,
    );
  }

  return {
    app: SIGNATURE,
    version: FORMAT_VERSION,
    exportedAt: Date.now(),
    cards: backupCards,
  };
}

export type ImportReport = {
  added: number;
  updated: number;
  skipped: number;
};

/**
 * Читання копії.
 *
 * Файл може бути будь-чим — юзер вибирає його руками, — тому перевіряється
 * кожне поле, а не лише підпис угорі. Картка з поламаним полем просто
 * пропускається: краще відновити дев'ять карток із десяти, ніж жодної.
 */
export function parseBackup(raw: string): { cards: BackupCard[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Це не схоже на файл копії — усередині не JSON" };
  }

  if (!isRecord(parsed) || parsed.app !== SIGNATURE) {
    return { error: "Файл створений не цим застосунком" };
  }
  if (typeof parsed.version !== "number" || parsed.version > FORMAT_VERSION) {
    return { error: "Файл створений новішою версією застосунку" };
  }
  if (!Array.isArray(parsed.cards)) {
    return { error: "У файлі немає списку карток" };
  }

  const cards = parsed.cards.filter(isBackupCard);
  return { cards };
}

/**
 * Злиття копії з тим, що вже є на пристрої.
 *
 * Картки зіставляються за `id`, а конфлікт вирішується за `updatedAt` —
 * перемагає новіша. Тому копію можна вливати скільки завгодно разів: повтор
 * нічого не зіпсує й не наплодить дублікатів. Це ж правило колись стане
 * основою синхронізації між пристроями.
 */
export async function restoreBackup(cards: BackupCard[]): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skipped: 0 };

  for (const incoming of cards) {
    const { photos, ...fields } = incoming;
    const existing = await db.cards.get(fields.id);

    if (existing && existing.updatedAt >= fields.updatedAt) {
      report.skipped += 1;
      continue;
    }

    await db.cards.put({ ...fields, deletedAt: 0 });
    if (existing) report.updated += 1;
    else report.added += 1;

    if (photos) {
      const front = photos.front ? dataUrlToBlob(photos.front) : undefined;
      const back = photos.back ? dataUrlToBlob(photos.back) : undefined;
      if (front || back) await db.photos.put({ cardId: fields.id, front, back });
    }
  }

  return report;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBackupCard(value: unknown): value is BackupCard {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.format === "string" &&
    (BARCODE_FORMATS as readonly string[]).includes(value.format as BarcodeFormat) &&
    typeof value.color === "string" &&
    typeof value.updatedAt === "number"
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // Рядок збирається шматками навмисно: `String.fromCharCode(...bytes)` для
  // фотографії на кілька мегабайтів означає мільйони аргументів в одному
  // виклику, і рушій падає на переповненні стека.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

function dataUrlToBlob(dataUrl: string): Blob | undefined {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return undefined;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] });
  } catch {
    return undefined;
  }
}

export function backupFileName(at: Date = new Date()): string {
  const stamp = at.toISOString().slice(0, 10);
  return `stashcards-${stamp}.json`;
}
