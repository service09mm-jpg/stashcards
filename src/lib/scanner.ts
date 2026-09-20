import {
  fromDetectorFormat,
  fromZXingFormat,
  zxingFormats,
  type BarcodeFormat,
} from "./barcodeFormats";

/**
 * Розпізнавання штрихкоду з камери.
 *
 * Тут два різні двигуни, і це не перестраховка. У Chrome на Android є
 * вбудований `BarcodeDetector` — він працює на системному коді, швидко й без
 * жодного зайвого байта. У Safari його немає й не передбачається, тож для
 * iPhone лишається wasm-збірка ZXing.
 *
 * Вибір між ними робиться один раз при відкритті сканера; для решти
 * застосунку обидва виглядають однаково.
 */

export type ScanHit = {
  code: string;
  format: BarcodeFormat;
};

export type Scanner = {
  /** Назва двигуна — показується в інтерфейсі, коли щось не розпізнається. */
  engine: "native" | "zxing";
  scan: (video: HTMLVideoElement) => Promise<ScanHit | null>;
};

/** Формати, які має сенс шукати на картці лояльності. */
const WANTED = [
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
];

export async function createScanner(): Promise<Scanner> {
  const native = await tryCreateNativeScanner();
  return native ?? createZXingScanner();
}

async function tryCreateNativeScanner(): Promise<Scanner | null> {
  const Detector = window.BarcodeDetector;
  if (!Detector) return null;

  try {
    const supported = await Detector.getSupportedFormats();
    const formats = WANTED.filter((format) => supported.includes(format));
    // Порожній перелік означає, що клас є, але жодного потрібного формату він
    // не читає, — тоді від нього користі немає.
    if (formats.length === 0) return null;

    const detector = new Detector({ formats });
    return {
      engine: "native",
      scan: async (video) => {
        const found = await detector.detect(video);
        for (const hit of found) {
          const format = fromDetectorFormat(hit.format);
          if (format && hit.rawValue) return { code: hit.rawValue, format };
        }
        return null;
      },
    };
  } catch {
    // Деякі складання Chrome оголошують клас, але падають на створенні —
    // тоді просто йдемо запасним шляхом.
    return null;
  }
}

function createZXingScanner(): Scanner {
  let canvas: HTMLCanvasElement | null = null;

  return {
    engine: "zxing",
    scan: async (video) => {
      const { readBarcodes } = await loadZXing();

      canvas ??= document.createElement("canvas");
      const image = grabFrame(video, canvas);
      if (!image) return null;

      const results = await readBarcodes(image, {
        // Приведення типу: перелік форматів зібраний у нашому довіднику, і
        // саме він — джерело правди про те, які написання розуміє ZXing.
        formats: zxingFormats() as never,
        // Картку тримають у руці, тож вона майже завжди трохи перекошена й
        // може бути повернута — без цих двох спроб розпізнавання майже не
        // спрацьовує.
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
        maxNumberOfSymbols: 1,
      });

      for (const result of results) {
        if (!result.isValid || !result.text) continue;
        const format = fromZXingFormat(result.format);
        if (format) return { code: result.text, format };
      }
      return null;
    },
  };
}

/**
 * Найбільша сторона кадру, який віддаємо декодеру.
 *
 * Камера дає 1080p і більше, але ZXing на такому кадрі витрачає сотні
 * мілісекунд — у прев'ю це виглядає як ривки. Зменшений кадр розпізнається
 * так само надійно, бо штрихкод тримають близько до об'єктива.
 */
const MAX_FRAME_SIDE = 900;

function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;

  const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(videoWidth, videoHeight));
  canvas.width = Math.round(videoWidth * scale);
  canvas.height = Math.round(videoHeight * scale);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

type ZXingReader = typeof import("zxing-wasm/reader");

let zxingPromise: Promise<ZXingReader> | null = null;

/**
 * Завантаження wasm-декодера.
 *
 * Два важливі моменти. Перший: модуль підвантажується лише коли юзер відкрив
 * сканер, — інакше кожен запуск застосунку тягнув би кілька сотень кілобайт
 * заради можливості, якою користуються раз на місяць.
 *
 * Другий, і він критичний: бібліотека за замовчуванням бере свій wasm-файл із
 * CDN. Для застосунку, сенс якого — працювати без мережі, це неприйнятно, тож
 * шлях примусово перенаправляється на файл із нашої ж збірки, який service
 * worker кладе в кеш разом з усім іншим.
 */
async function loadZXing(): Promise<ZXingReader> {
  zxingPromise ??= (async () => {
    const [reader, { default: wasmUrl }] = await Promise.all([
      import("zxing-wasm/reader"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);
    reader.prepareZXingModule({
      overrides: { locateFile: () => wasmUrl },
    });
    return reader;
  })();
  return zxingPromise;
}
