/**
 * Довідник форматів штрихкодів.
 *
 * Кожна бібліотека називає ті самі формати по-своєму: браузерний
 * `BarcodeDetector` і wasm-декодер ZXing розходяться навіть у написанні
 * «EAN-13». Щоб ця розбіжність не розповзлася застосунком, вона замкнена
 * тут: решта коду знає лише наші власні ідентифікатори з `BARCODE_FORMATS`.
 *
 * За основу взято написання `BarcodeDetector`, бо це єдиний із трьох, хто є
 * стандартом, — решта відображається на нього. Відповідність генератору
 * живе в `barcode.ts`: там вона не назва, а сама функція-кодувальник.
 */

export const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "itf",
  "qr_code",
  "pdf417",
  "aztec",
  "data_matrix",
] as const;

export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

type FormatSpec = {
  /** Як формат називається для людини в інтерфейсі. */
  label: string;
  /** Назва формату в zxing-wasm — ним картка розпізнається на iOS. */
  zxing: string;
  /** Двовимірні коди малюються квадратом, лінійні — широкою смугою. */
  matrix: boolean;
};

const SPECS: Record<BarcodeFormat, FormatSpec> = {
  ean_13: { label: "EAN-13", zxing: "EAN13", matrix: false },
  ean_8: { label: "EAN-8", zxing: "EAN8", matrix: false },
  upc_a: { label: "UPC-A", zxing: "UPCA", matrix: false },
  upc_e: { label: "UPC-E", zxing: "UPCE", matrix: false },
  code_128: { label: "Code 128", zxing: "Code128", matrix: false },
  code_39: { label: "Code 39", zxing: "Code39", matrix: false },
  code_93: { label: "Code 93", zxing: "Code93", matrix: false },
  codabar: { label: "Codabar", zxing: "Codabar", matrix: false },
  itf: { label: "ITF", zxing: "ITF", matrix: false },
  qr_code: { label: "QR-код", zxing: "QRCode", matrix: true },
  pdf417: { label: "PDF417", zxing: "PDF417", matrix: true },
  aztec: { label: "Aztec", zxing: "Aztec", matrix: true },
  data_matrix: { label: "Data Matrix", zxing: "DataMatrix", matrix: true },
};

export function formatLabel(format: BarcodeFormat): string {
  return SPECS[format].label;
}

export function isMatrixFormat(format: BarcodeFormat): boolean {
  return SPECS[format].matrix;
}

/** Усі назви форматів для zxing-wasm — передаються декодеру як список пошуку. */
export function zxingFormats(): string[] {
  return BARCODE_FORMATS.map((format) => SPECS[format].zxing);
}

const BY_ZXING = new Map<string, BarcodeFormat>(
  BARCODE_FORMATS.map((format) => [SPECS[format].zxing, format]),
);

/** Зворотний переклад: що повернув декодер → наш ідентифікатор. */
export function fromZXingFormat(name: string): BarcodeFormat | null {
  return BY_ZXING.get(name) ?? null;
}

/**
 * Зворотний переклад для `BarcodeDetector`. Його написання збігається з нашим,
 * але формат може прийти й такий, якого в нас немає, — тоді відповіді немає.
 */
export function fromDetectorFormat(name: string): BarcodeFormat | null {
  return (BARCODE_FORMATS as readonly string[]).includes(name)
    ? (name as BarcodeFormat)
    : null;
}

const DIGITS_ONLY = /^\d+$/;

/** Скільки саме цифр має бути у форматі з фіксованою довжиною. */
const FIXED_DIGITS: Partial<Record<BarcodeFormat, number>> = {
  ean_13: 13,
  ean_8: 8,
  upc_a: 12,
  upc_e: 8,
};

/**
 * Контрольна цифра EAN/UPC.
 *
 * Рахується за тим самим правилом для всіх довжин: цифри справа наліво,
 * через одну помножені на 3, а решта на 1; контрольна доповнює суму до
 * найближчого десятка.
 */
export function eanCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  for (let i = digitsWithoutCheck.length - 1, weight = 3; i >= 0; i -= 1, weight = 4 - weight) {
    sum += Number(digitsWithoutCheck[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidEanCheckDigit(code: string): boolean {
  return eanCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Чи можна взагалі намалювати такий код у цьому форматі.
 *
 * Перевіряємо самі, до виклику генератора: bwip-js у відповідь на негодящі
 * дані кидає виняток із текстом для розробника, а юзеру біля каси потрібна
 * зрозуміла підказка ще на етапі введення.
 *
 * @returns текст помилки або `null`, якщо все гаразд.
 */
export function validateCode(format: BarcodeFormat, code: string): string | null {
  if (code.length === 0) return "Порожній код";

  const fixed = FIXED_DIGITS[format];
  if (fixed !== undefined) {
    if (!DIGITS_ONLY.test(code)) return `${formatLabel(format)} складається лише з цифр`;
    if (code.length !== fixed) {
      return `${formatLabel(format)} — це рівно ${fixed} цифр, а тут ${code.length}`;
    }
    // UPC-E має власну, несумісну схему контрольної цифри, тож перевіряємо
    // лише ті формати, де працює звичайне правило EAN.
    if (format !== "upc_e" && !hasValidEanCheckDigit(code)) {
      return "Не сходиться контрольна цифра — перевірте останню";
    }
    return null;
  }

  if (format === "itf") {
    if (!DIGITS_ONLY.test(code)) return "ITF складається лише з цифр";
    if (code.length % 2 !== 0) return "В ITF має бути парна кількість цифр";
    return null;
  }

  if (format === "code_39") {
    if (!/^[0-9A-Z\-.$/+% ]+$/.test(code)) {
      return "Code 39 — лише великі латинські літери, цифри й символи - . $ / + %";
    }
    return null;
  }

  if (format === "codabar") {
    if (!/^[A-D][0-9\-$:/.+]*[A-D]$/.test(code)) {
      return "Codabar починається й закінчується літерою A, B, C або D";
    }
    return null;
  }

  return null;
}

/**
 * Приведення введеного коду до вигляду, який очікує формат.
 *
 * Пробіли зрізаються завжди — їх легко захопити при копіюванні. Формати, що
 * знають лише великі літери, переводяться у верхній регістр самі: змушувати
 * юзера думати про це немає сенсу.
 */
export function normalizeCode(format: BarcodeFormat, raw: string): string {
  const trimmed = raw.trim();
  if (format === "code_39" || format === "codabar") return trimmed.toUpperCase();
  if (FIXED_DIGITS[format] !== undefined || format === "itf") {
    // У надрукованому EAN цифри розділені пробілами, а сканер бачить їх разом.
    return trimmed.replace(/[\s-]/g, "");
  }
  return trimmed;
}

/**
 * Здогад про формат за самим кодом — щоб не питати юзера, коли відповідь
 * очевидна. Використовується лише при ручному введенні: якщо код прийшов зі
 * сканера, формат відомий точно й гадати не треба.
 */
export function guessFormat(code: string): BarcodeFormat {
  const clean = code.trim();
  if (DIGITS_ONLY.test(clean)) {
    if (clean.length === 13 && hasValidEanCheckDigit(clean)) return "ean_13";
    if (clean.length === 8 && hasValidEanCheckDigit(clean)) return "ean_8";
    if (clean.length === 12 && hasValidEanCheckDigit(clean)) return "upc_a";
  }
  // Code 128 бере будь-який ASCII і не має вимог до довжини — найбезпечніший
  // варіант за замовчуванням для всього іншого.
  return "code_128";
}
