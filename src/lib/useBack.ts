import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Повернення на крок назад.
 *
 * Здавалося б, кнопка «назад» — це посилання на головну. Але посилання
 * *додає* запис в історію, а не знімає: після десятка відкритих карток
 * системна кнопка «назад» на Android веде не на головну, а назад по всіх
 * переглянутих картках по черзі. Саме тому тут справжній `navigate(-1)`.
 *
 * Виняток один: екран може виявитися першим в історії — коли застосунок
 * відкрили одразу за посиланням на картку. Тоді знімати нема чого, і
 * повертатися доводиться переходом із заміною запису, щоб і в цьому випадку
 * наступне «назад» закривало застосунок, а не повертало на щойно покинутий
 * екран.
 *
 * Ознака першого запису — ключ `"default"`: React Router позначає ним
 * початкову адресу й лише її.
 */
export function useBack(fallback = "/"): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  const isFirstEntry = key === "default";

  return useCallback(() => {
    if (isFirstEntry) navigate(fallback, { replace: true });
    else navigate(-1);
  }, [isFirstEntry, fallback, navigate]);
}
