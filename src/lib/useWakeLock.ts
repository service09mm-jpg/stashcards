import { useEffect } from "react";

/**
 * Не дає екрану згаснути, доки відкрита картка.
 *
 * Дрібниця, без якої застосунок незручний: касир наводить сканер, екран
 * гасне за 30 секунд, і все починається спочатку. Блокування вмикається лише
 * на екрані картки — тримати його завжди означало б без потреби садити
 * батарею.
 *
 * Керувати яскравістю з браузера не можна, тому екран картки компенсує це
 * інакше: повністю білим тлом на весь екран.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Браузер має право відмовити — наприклад, за низького заряду.
        // Це не привід ламати екран картки, тому просто живемо без блокування.
      }
    };

    // Система знімає блокування, щойно застосунок згортають. Повернувшись,
    // його треба попросити заново — інакше після перемикання на інший
    // застосунок екран знову почне гаснути.
    const onVisible = () => {
      if (!released && document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
