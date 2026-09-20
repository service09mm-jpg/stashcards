import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, Navigate, useParams } from "react-router";
import { renderBarcode } from "@/lib/barcode";
import { formatLabel, isMatrixFormat } from "@/lib/barcodeFormats";
import { getCard, getPhotos, touchCard } from "@/lib/db";
import { useWakeLock } from "@/lib/useWakeLock";
import { BackIcon, PencilIcon } from "@/ui/icons";

/**
 * Екран картки — заради нього застосунок і написаний.
 *
 * Три речі тут не косметичні, а функціональні:
 *
 * 1. Тло біле й на весь екран. Яскравістю екрана з браузера керувати не можна,
 *    а сканер каси читає відбите світло — тож білий на весь екран це єдине,
 *    чим можна йому допомогти. Через це екран випадає з темного оформлення
 *    решти застосунку, і так і має бути.
 * 2. Екран не гасне, доки картка відкрита.
 * 3. Код можна повернути на 90°. На вузькому екрані повернутий штрихкод
 *    виходить майже вдвічі довшим, а довжина — це те, що сканеру найважче
 *    подолати.
 */
export function CardViewPage() {
  const { id = "" } = useParams();
  const card = useLiveQuery(() => getCard(id), [id]);
  const photos = useLiveQuery(() => getPhotos(id), [id]);
  const [rotated, setRotated] = useState(false);

  useWakeLock(card != null);

  // Відмітка «карткою скористалися» ставиться саме тут, на показі коду, а не
  // при відкритті списку: це єдиний момент, коли точно відомо, що картка
  // справді знадобилася. З цих відміток і будується порядок у списку.
  useEffect(() => {
    if (id) void touchCard(id);
  }, [id]);

  const barcode = useMemo(
    () => (card ? renderBarcode(card.format, card.code) : null),
    [card],
  );

  if (card === undefined) return null;
  if (card === null) return <Navigate to="/" replace />;

  const matrix = isMatrixFormat(card.format);

  return (
    <div className="flex h-full flex-col bg-white text-black">
      <header className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          aria-label="Назад"
          className="flex size-11 items-center justify-center rounded-full active:bg-black/5"
        >
          <BackIcon />
        </Link>
        <span className="truncate px-2 text-base font-semibold">{card.name}</span>
        <Link
          to={`/card/${card.id}/edit`}
          aria-label="Змінити картку"
          className="flex size-11 items-center justify-center rounded-full active:bg-black/5"
        >
          <PencilIcon />
        </Link>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {barcode?.ok ? (
          <div
            className={
              rotated
                ? "absolute top-1/2 left-1/2 w-[78dvh] -translate-x-1/2 -translate-y-1/2 rotate-90"
                : "absolute top-1/2 left-1/2 w-[94%] -translate-x-1/2 -translate-y-1/2"
            }
          >
            {/*
              Вставка розмітки напряму безпечна: у цей SVG не потрапляє жодного
              введеного юзером символу — генератор викликається з
              `includetext: false`, тож усередині лише геометрія ліній.
              Підпис під кодом малюється окремо, звичайним текстом.
            */}
            <div
              data-testid="barcode"
              className="[&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: barcode.svg }}
            />
          </div>
        ) : (
          <p className="absolute top-1/2 left-1/2 w-72 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-red-600">
            {barcode?.error ?? "Не вдалося намалювати код"}
          </p>
        )}
      </div>

      <footer className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-center font-mono text-lg tracking-[0.2em] break-all">
          {card.code}
        </p>
        <p className="mt-1 text-center text-xs text-black/40">
          {formatLabel(card.format)}
          {card.note ? ` · ${card.note}` : ""}
        </p>

        <div className="mt-3 flex justify-center gap-2">
          {/* Квадратні коди від повороту нічого не виграють — кнопки там немає. */}
          {!matrix && (
            <button
              type="button"
              onClick={() => setRotated((value) => !value)}
              className="min-h-11 rounded-xl px-4 text-sm font-medium text-black/60 active:bg-black/5"
            >
              {rotated ? "Горизонтально" : "Повернути"}
            </button>
          )}
          {photos?.front || photos?.back ? <PhotoButtons photos={photos} /> : null}
        </div>
      </footer>
    </div>
  );
}

function PhotoButtons({ photos }: { photos: { front?: Blob; back?: Blob } }) {
  const [shown, setShown] = useState<Blob | null>(null);

  return (
    <>
      {photos.front && (
        <button
          type="button"
          onClick={() => setShown(photos.front ?? null)}
          className="min-h-11 rounded-xl px-4 text-sm font-medium text-black/60 active:bg-black/5"
        >
          Лицьовий бік
        </button>
      )}
      {photos.back && (
        <button
          type="button"
          onClick={() => setShown(photos.back ?? null)}
          className="min-h-11 rounded-xl px-4 text-sm font-medium text-black/60 active:bg-black/5"
        >
          Зворот
        </button>
      )}
      {shown && <PhotoOverlay photo={shown} onClose={() => setShown(null)} />}
    </>
  );
}

function PhotoOverlay({ photo, onClose }: { photo: Blob; onClose: () => void }) {
  const url = useObjectUrl(photo);

  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Закрити фото"
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/90 p-4"
    >
      <img src={url} alt="" className="max-h-full max-w-full rounded-xl" />
    </button>
  );
}

/**
 * Посилання на блоб із пам'яті.
 *
 * Відкликати його обов'язково: інакше кожне відкриття фото лишало б у вкладці
 * мегабайт, який браузер не звільнить до перезавантаження сторінки. Звідси й
 * ефект — він тут існує рівно заради прибирання.
 */
function useObjectUrl(blob: Blob): string {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}
