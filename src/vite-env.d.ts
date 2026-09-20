/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Вимкнений за замовчуванням спосіб віддати wasm-файл: Vite кладе його в
// збірку як звичайний ресурс і повертає посилання. Саме воно потім
// підставляється декодеру замість вшитого в бібліотеку посилання на CDN.
declare module "*.wasm?url" {
  const src: string;
  export default src;
}

/**
 * `BarcodeDetector` є не в усіх браузерах і поки не описаний у стандартних
 * типах, тому оголошуємо рівно ту його частину, якою користуємося.
 */
interface DetectedBarcodeLike {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(source: CanvasImageSource | Blob | ImageData): Promise<DetectedBarcodeLike[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
