import { Link } from "react-router";
import { cardInitials, type Card } from "@/lib/card";
import { formatLabel } from "@/lib/barcodeFormats";

/**
 * Плитка картки у списку.
 *
 * Свідомо без фотографії, хоча фото в картки може бути. Список — найчастіший
 * екран застосунку, і він має малюватися миттєво; фотографії ж лежать в
 * окремій таблиці саме для того, щоб їх не читати заради списку. Упізнаваність
 * дає колір: його видно з відстані й ще до того, як око встигло прочитати
 * назву.
 */
export function CardTile({ card }: { card: Card }) {
  return (
    <Link
      to={`/card/${card.id}`}
      className="no-select flex aspect-[1.586/1] flex-col justify-between rounded-3xl p-4 text-ink transition-transform active:scale-[0.97]"
      style={{ backgroundColor: card.color }}
    >
      <span className="text-3xl font-bold opacity-30">{cardInitials(card.name)}</span>
      <span>
        <span className="block truncate text-base leading-tight font-semibold">
          {card.name}
        </span>
        <span className="block text-xs opacity-60">{formatLabel(card.format)}</span>
      </span>
    </Link>
  );
}
