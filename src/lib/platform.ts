/**
 * Дрібні відмінності платформ, які видно юзеру.
 *
 * Тримаємо їх в одному місці й перевіряємо саме можливості, а не «який це
 * браузер», — крім єдиного випадку, де без імені не обійтися: підказки про
 * встановлення на iOS.
 */

/** Чи запущено застосунок як застосунок, а не як вкладку браузера. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Власне, нестандартне поле Safari — єдиний спосіб дізнатися це на iPhone.
    ("standalone" in navigator && navigator.standalone === true)
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPad із iPadOS 13+ представляється як Mac, і відрізнити його можна
    // тільки за наявністю сенсорного екрана.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Чи варто показувати підказку про встановлення.
 *
 * На Android браузер сам пропонує встановити застосунок, і втручатися немає
 * потреби. На iOS такої пропозиції не існує в принципі: Apple не дає
 * сайту жодного способу її викликати, і єдиний шлях — пояснити юзеру, що
 * треба натиснути «Поділитися» й «На екран «Додому».
 */
export function needsIosInstallHint(): boolean {
  return isIos() && !isStandalone();
}

/**
 * Збереження файла копії.
 *
 * На iPhone у режимі застосунку звичайне завантаження або нічого не робить,
 * або відкриває файл у новій вкладці без можливості зберегти. Робочий шлях
 * там один — системне вікно «Поділитися», через яке файл кладуть у «Файли»,
 * надсилають собі в месенджер чи в хмару. Тому спершу пробуємо його, а на
 * решті платформ лишається звичайне завантаження.
 */
export async function saveFile(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (error) {
      // Юзер міг просто закрити вікно «Поділитися» — це не помилка й не
      // привід одразу підсовувати йому ще й завантаження.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Посилання живе, доки браузер не забрав файл; відпускаємо його наступним
  // кадром, інакше завантаження в Safari іноді зривається.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
