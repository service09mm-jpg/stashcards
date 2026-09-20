import { describe, expect, it } from "vitest";
import { renderBarcode } from "./barcode";
import { BARCODE_FORMATS } from "./barcodeFormats";

/** Код, який гарантовано правильний для кожного формату. */
const SAMPLES: Record<(typeof BARCODE_FORMATS)[number], string> = {
  ean_13: "4006381333931",
  ean_8: "96385074",
  upc_a: "036000291452",
  upc_e: "01234565",
  code_128: "CARD-0042",
  code_39: "CARD-0042",
  code_93: "CARD-0042",
  codabar: "A12345B",
  itf: "12345678",
  qr_code: "https://example.com/картка",
  pdf417: "CARD-0042",
  aztec: "CARD-0042",
  data_matrix: "CARD-0042",
};

describe("малювання штрихкоду", () => {
  it.each(BARCODE_FORMATS)("малює %s", (format) => {
    const result = renderBarcode(format, SAMPLES[format]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg).toMatch(/^<svg /);
    expect(result.svg).toContain("</svg>");
  });

  it("не згладжує краї — від цього залежить, чи прочитає код сканер", () => {
    const result = renderBarcode("ean_13", SAMPLES.ean_13);

    expect(result.ok && result.svg).toContain('shape-rendering="crispEdges"');
  });

  it("не пускає в SVG нічого з того, що ввів юзер", () => {
    // Підпис під кодом малюється окремо, звичайним текстом сторінки. Саме
    // тому готовий SVG можна вставляти в розмітку напряму.
    const result = renderBarcode("qr_code", '<script>alert(1)</script>');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg).not.toContain("script");
  });

  it("повертає зрозумілу помилку замість коду, якого не буває", () => {
    const result = renderBarcode("ean_13", "123");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/13 цифр/);
  });
});
