import {
  azteccode,
  code128,
  code39,
  code93,
  datamatrix,
  drawingSVG,
  ean13,
  ean8,
  interleaved2of5,
  pdf417,
  qrcode,
  rationalizedCodabar,
  upca,
  upce,
  type RenderOptions,
} from "bwip-js/browser";
import { isMatrixFormat, validateCode, type BarcodeFormat } from "./barcodeFormats";

/**
 * Малювання штрихкоду.
 *
 * Уся генерація відбувається в браузері: жодного запиту до сервісів на кшталт
 * «barcode API» — інакше картка не відкрилася б офлайн, а це єдине, заради
 * чого застосунок існує.
 *
 * Кодувальники імпортуються поіменно, а не через спільну `toSVG()`. Це не
 * стилістика: `toSVG()` посилається на всі сто з гаком символогій bwip-js, і
 * складальник не може викинути жодної — застосунок важчав би вчетверо заради
 * поштових кодів, яких тут ніколи не буде.
 *
 * Результат — SVG, а не растр. Штрихкод має бути чітким на будь-якому екрані
 * й за будь-якого розміру: сканер каси читає межу між чорним і білим, і
 * розмите при масштабуванні PNG він може не взяти.
 */

type Encoder = (options: RenderOptions, drawing: ReturnType<typeof drawingSVG>) => string;

const ENCODERS: Record<BarcodeFormat, Encoder> = {
  ean_13: ean13,
  ean_8: ean8,
  upc_a: upca,
  upc_e: upce,
  code_128: code128,
  code_39: code39,
  code_93: code93,
  codabar: rationalizedCodabar,
  itf: interleaved2of5,
  qr_code: qrcode,
  pdf417,
  aztec: azteccode,
  data_matrix: datamatrix,
};

export type BarcodeResult =
  | { ok: true; svg: string }
  | { ok: false; error: string };

export function renderBarcode(format: BarcodeFormat, code: string): BarcodeResult {
  const invalid = validateCode(format, code);
  if (invalid) return { ok: false, error: invalid };

  const matrix = isMatrixFormat(format);

  try {
    const svg = ENCODERS[format](
      {
        // `bcid` кодувальник поіменно не використовує, але тип вимагає його
        // присутності — лишаємо порожнім, щоб не плодити брехливого значення.
        bcid: "",
        text: code,
        // Масштаб і висота задають лише пропорції: остаточний розмір визначає
        // CSS, розтягуючи SVG на всю ширину екрана.
        scale: 4,
        ...(matrix ? {} : { height: 22 }),
        // Підпис під кодом малюємо самі, звичайним текстом сторінки: так його
        // видно краще, і — головне — у згенерований SVG не потрапляє жодного
        // введеного юзером рядка, лише геометрія ліній.
        includetext: false,
        backgroundcolor: "FFFFFF",
        barcolor: "000000",
        // Поля навколо коду — вимога стандарту: без «тихої зони» сканер не
        // знаходить початок і кінець символу.
        paddingwidth: 10,
        paddingheight: matrix ? 10 : 4,
      },
      drawingSVG(),
    );

    return { ok: true, svg: crispen(svg) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не вдалося намалювати код",
    };
  }
}

/**
 * Заборона згладжування країв.
 *
 * За замовчуванням браузер згладжує межі фігур, і на дробовому масштабі
 * чорна лінія отримує сірий край. Для ока це непомітно, для сканера — розмита
 * межа, яку він може прочитати як лінію іншої товщини.
 */
function crispen(svg: string): string {
  return svg.replace("<svg ", '<svg shape-rendering="crispEdges" ');
}
