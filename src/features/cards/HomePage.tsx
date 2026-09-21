import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router";
import type { Card } from "@/lib/card";
import { listCards, reorderCards } from "@/lib/db";
import { PlusIcon, SettingsIcon } from "@/ui/icons";
import { CardTile } from "./CardTile";
import { IosInstallHint } from "./IosInstallHint";

/**
 * Скільки тримати картку, перш ніж почнеться перетягування.
 *
 * Значення — компроміс між двома жестами на одному й тому самому елементі.
 * Менше — і звичайний дотик по картці іноді перетворювався б на перетягування;
 * більше — і перестановка почала б здаватися такою, що не працює. `tolerance`
 * тут рятує гортання: якщо палець зрушив раніше, ніж минув час, жест
 * лишається гортанням списку.
 */
const DRAG_HOLD_MS = 250;
const DRAG_TOLERANCE_PX = 8;

const HINT_SEEN_KEY = "stashcards.reorder-hint-seen";

/**
 * Головний екран — список карток.
 *
 * Порядок задає юзер і тільки юзер: колись список сортувався за частотою
 * використання, і це виявилося гіршим за сталий порядок. Список, який сам себе
 * перебудовує, доводиться щоразу перечитувати очима; сталий — запам'ятовується
 * рукою, і до потрібної картки з часом тягнешся, не дивлячись.
 */
export function HomePage() {
  // `undefined` тут означає «ще читаємо з диска», і це не те саме, що порожній
  // список: інакше на частку секунди блимав би екран «карток немає».
  const cards = useLiveQuery(listCards, []);

  /*
    Порядок, уже показаний юзеру, але ще не записаний у базу. Без нього картка
    після відпускання встигла б стрибнути на старе місце й повернутися назад,
    коли доїде запис.
  */
  const [pendingOrder, setPendingOrder] = useState<readonly string[] | null>(null);
  const [hintSeen, setHintSeen] = useState(
    () => localStorage.getItem(HINT_SEEN_KEY) === "1",
  );

  const items = useMemo(() => applyOrder(cards, pendingOrder), [cards, pendingOrder]);
  const ids = useMemo(() => items.map((card) => card.id), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: DRAG_HOLD_MS, tolerance: DRAG_TOLERANCE_PX },
    }),
  );

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = arrayMove(ids, from, to);
    setPendingOrder(next);
    await reorderCards(next);
    setPendingOrder(null);

    if (!hintSeen) {
      localStorage.setItem(HINT_SEEN_KEY, "1");
      setHintSeen(true);
    }
  };

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

        {cards === undefined ? null : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Підказка зникає назавжди, щойно юзер переставить першу картку:
                далі вона вже нічого не пояснює, а місце займає. */}
            {!hintSeen && items.length > 1 && (
              <p className="mb-3 text-center text-xs text-muted">
                Притримайте картку й перетягніть, щоб змінити порядок
              </p>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <SortableContext items={ids} strategy={rectSortingStrategy}>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((card) => (
                    <CardTile key={card.id} card={card} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
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

/**
 * Накладає щойно показаний юзеру порядок на те, що прийшло з бази.
 *
 * Якщо перелік карток за цей час змінився — картку видалили на іншій вкладці,
 * додали нову — недописаний порядок відкидається: свіжі дані з бази вірніші за
 * намір, який уже застарів.
 */
function applyOrder(
  cards: Card[] | undefined,
  order: readonly string[] | null,
): Card[] {
  if (!cards) return [];
  if (!order || order.length !== cards.length) return cards;

  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered = order.map((id) => byId.get(id)).filter((card) => card !== undefined);

  return ordered.length === cards.length ? ordered : cards;
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
