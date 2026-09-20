import { describe, expect, it } from "vitest";
import {
  BARCODE_FORMATS,
  eanCheckDigit,
  fromZXingFormat,
  guessFormat,
  normalizeCode,
  validateCode,
  zxingFormats,
} from "./barcodeFormats";

describe("контрольна цифра EAN", () => {
  it("рахується за стандартом", () => {
    // Приклади зі специфікації GS1: перші 12 цифр і очікувана 13-та.
    expect(eanCheckDigit("482000000000")).toBe(0);
    expect(eanCheckDigit("400638133393")).toBe(1);
    expect(eanCheckDigit("590123412345")).toBe(7);
    // UPC-A коротший на цифру, але правило те саме.
    expect(eanCheckDigit("03600029145")).toBe(2);
  });
});

describe("перевірка коду", () => {
  it("приймає правильний EAN-13", () => {
    expect(validateCode("ean_13", "4006381333931")).toBeNull();
  });

  it("ловить зіпсовану контрольну цифру", () => {
    expect(validateCode("ean_13", "4006381333932")).toMatch(/контрольна/);
  });

  it("ловить неправильну довжину", () => {
    expect(validateCode("ean_13", "400638133")).toMatch(/13 цифр/);
  });

  it("не пускає літери у формат із самих цифр", () => {
    expect(validateCode("ean_13", "40063813339AB")).toMatch(/цифр/);
  });

  it("вимагає парної кількості цифр в ITF", () => {
    expect(validateCode("itf", "12345")).toMatch(/парна/);
    expect(validateCode("itf", "123456")).toBeNull();
  });

  it("вимагає літер-обмежувачів у Codabar", () => {
    expect(validateCode("codabar", "12345")).toMatch(/A, B, C або D/);
    expect(validateCode("codabar", "A12345B")).toBeNull();
  });

  it("не пускає малі літери в Code 39", () => {
    expect(validateCode("code_39", "abc")).toMatch(/Code 39/);
    expect(validateCode("code_39", "ABC-123")).toBeNull();
  });

  it("пропускає будь-який текст у Code 128 і QR", () => {
    expect(validateCode("code_128", "Card#42/x")).toBeNull();
    expect(validateCode("qr_code", "https://example.com/картка")).toBeNull();
  });

  it("не приймає порожній код у жодному форматі", () => {
    for (const format of BARCODE_FORMATS) {
      expect(validateCode(format, "")).toBe("Порожній код");
    }
  });
});

describe("нормалізація введеного коду", () => {
  it("прибирає пробіли й дефіси з цифрових форматів", () => {
    // Саме так номер надрукований на картці — з проміжками між групами.
    expect(normalizeCode("ean_13", " 4006 3813-33931 ")).toBe("4006381333931");
  });

  it("піднімає регістр там, де формат знає лише великі літери", () => {
    expect(normalizeCode("code_39", " abc-12 ")).toBe("ABC-12");
    expect(normalizeCode("codabar", "a123b")).toBe("A123B");
  });

  it("не чіпає вміст QR, крім країв", () => {
    expect(normalizeCode("qr_code", "  Ключ-Key 42  ")).toBe("Ключ-Key 42");
  });
});

describe("здогад про формат", () => {
  it("упізнає EAN-13 за довжиною й контрольною цифрою", () => {
    expect(guessFormat("4006381333931")).toBe("ean_13");
  });

  it("упізнає UPC-A", () => {
    expect(guessFormat("036000291452")).toBe("upc_a");
  });

  it("не вважає EAN-13 те, у чого не сходиться контрольна цифра", () => {
    expect(guessFormat("4006381333932")).toBe("code_128");
  });

  it("для довільного тексту пропонує Code 128", () => {
    expect(guessFormat("CARD-42")).toBe("code_128");
  });
});

describe("відповідність назв ZXing", () => {
  it("перекладається в обидва боки без втрат", () => {
    const names = zxingFormats();
    expect(names).toHaveLength(BARCODE_FORMATS.length);
    for (const name of names) {
      expect(fromZXingFormat(name)).not.toBeNull();
    }
  });

  it("мовчки ігнорує формат, якого в застосунку немає", () => {
    // ZXing уміє читати й те, чого не буває на картках лояльності.
    expect(fromZXingFormat("MaxiCode")).toBeNull();
  });
});
