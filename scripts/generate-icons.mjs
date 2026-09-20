import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/**
 * Генератор іконок застосунку.
 *
 * Іконки малюються кодом, а не лежать у репозиторії картинками, з двох
 * причин: їх шість розмірів і призначень, і будь-яка зміна знака інакше
 * означала б переробити всі шість руками. Растеризація тут своя, без
 * бібліотек, — знак складається з прямокутників, для них цього досить, а
 * тягнути заради них залежність із нативним модулем немає сенсу.
 *
 * Запуск: `npm run icons`.
 */

const INK = [0x09, 0x09, 0x0b, 0xff];
const LIGHT = [0xfa, 0xfa, 0xfa, 0xff];

/**
 * Пропорції штрихів знака — навмисно нерівномірні, щоб з першого погляду
 * читалося «штрихкод», а не «смужки». Числа — відносні ширини: штрих,
 * проміжок, штрих, проміжок…
 */
const PATTERN = [3, 2, 1, 2, 2, 3, 1, 2, 3, 2, 1, 3, 2, 2, 1];

/**
 * @param {number} size сторона іконки в точках
 * @param {number} coverage яку частку сторони займає знак
 */
function drawIcon(size, coverage) {
  const pixels = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i += 1) {
    pixels.set(INK, i * 4);
  }

  const total = PATTERN.reduce((sum, weight) => sum + weight, 0);
  const artWidth = Math.round(size * coverage);
  const artHeight = Math.round(size * coverage * 0.66);
  const left = Math.round((size - artWidth) / 2);
  const top = Math.round((size - artHeight) / 2);
  const unit = artWidth / total;

  let offset = 0;
  PATTERN.forEach((weight, index) => {
    const barStart = left + Math.round(offset * unit);
    const barEnd = left + Math.round((offset + weight) * unit);
    offset += weight;

    // Кожен другий елемент візерунка — проміжок, а не штрих.
    if (index % 2 === 1) return;

    for (let y = top; y < top + artHeight; y += 1) {
      for (let x = barStart; x < barEnd; x += 1) {
        pixels.set(LIGHT, (y * size + x) * 4);
      }
    }
  });

  return pixels;
}

function encodePng(size, pixels) {
  const stride = size * 4;
  // Кожен рядок PNG починається з байта фільтра; нуль означає «без фільтра».
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 біт на канал
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // стандартна фільтрація
  ihdr[12] = 0; // без черезрядковості

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const ICONS = [
  { file: "public/icon-192.png", size: 192, coverage: 0.62 },
  { file: "public/icon-512.png", size: 512, coverage: 0.62 },
  // Для maskable знак менший: система має право обрізати іконку під свою
  // форму, і все, що виходить за центральні 80%, може не вціліти.
  { file: "public/icon-maskable-512.png", size: 512, coverage: 0.46 },
  { file: "public/apple-touch-icon.png", size: 180, coverage: 0.62 },
];

for (const { file, size, coverage } of ICONS) {
  writeFileSync(file, encodePng(size, drawIcon(size, coverage)));
  console.log(`${file} — ${size}×${size}`);
}

const bars = (() => {
  const total = PATTERN.reduce((sum, weight) => sum + weight, 0);
  let offset = 0;
  return PATTERN.map((weight, index) => {
    const x = (offset / total) * 20 + 2;
    const width = (weight / total) * 20;
    offset += weight;
    return index % 2 === 1
      ? ""
      : `<rect x="${x.toFixed(2)}" y="7" width="${width.toFixed(2)}" height="10" fill="#fafafa"/>`;
  }).join("");
})();

writeFileSync(
  "public/favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#09090b"/>${bars}</svg>\n`,
);
console.log("public/favicon.svg");
