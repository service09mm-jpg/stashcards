import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router";
import { listCards } from "@/lib/db";
import { PlusIcon, SettingsIcon } from "@/ui/icons";
import { CardTile } from "./CardTile";
import { IosInstallHint } from "./IosInstallHint";

/**
 * Головний екран — список карток.
 *
 * Картки впорядковані за останнім використанням (див. `listCards`), тож та,
 * що потрібна зараз, майже завжди стоїть першою. Разом із відкриттям з іконки
 * це дає той самий шлях у два дотики, заради якого все й робилося.
 */
export function HomePage() {
  // `undefined` тут означає «ще читаємо з диска», і це не те саме, що порожній
  // список: інакше на частку секунди блимав би екран «карток немає».
  const cards = useLiveQuery(listCards, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <h1 className="text-2xl font-bold tracking-tight">StashCards</h1>
        <Link
          to="/settings"
          aria-label="Налаштування"
          className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface"
        >
          <SettingsIcon />
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-32">
        <IosInstallHint />

        {cards === undefined ? null : cards.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <li key={card.id}>
                <CardTile card={card} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {/*
        Кнопка додавання закріплена внизу, а не в шапці: до верху екрана
        великого телефона великим пальцем просто не дотягнутися.
      */}
      <Link
        to="/add"
        aria-label="Додати картку"
        className="fixed right-5 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex size-16 items-center justify-center rounded-full bg-text text-ink shadow-lg shadow-black/40 transition-transform active:scale-95"
      >
        <PlusIcon className="size-7" />
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-24 text-center">
      <p className="text-lg font-medium">Поки порожньо</p>
      <p className="mt-2 text-sm text-muted">
        Додайте першу картку — відскануйте штрихкод
        <br />
        або введіть номер руками.
      </p>
    </div>
  );
}
