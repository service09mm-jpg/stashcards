import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import "@testing-library/jest-dom/vitest";
// jsdom не має IndexedDB, а на ньому тримається все сховище застосунку.
// Ця підміна дає тестам справжню реалізацію в пам'яті, тож репозиторій
// карток тестується без жодних моків.
import "fake-indexeddb/auto";

/*
  jsdom має власний `Blob`, якого не впізнає `structuredClone` — а саме ним
  IndexedDB копіює значення при записі. Через це збережене фото поверталося б
  із бази порожнім об'єктом, і тести сховища перевіряли б неіснуючу ваду
  замість справжньої поведінки браузера. Реалізація з Node проходить
  копіювання без втрат, тож підставляємо її.
*/
globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob;
globalThis.File = NodeFile as unknown as typeof globalThis.File;
