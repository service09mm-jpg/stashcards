import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router";
import { formatLabel } from "@/lib/barcodeFormats";
import { cardInitials, type Card } from "@/lib/card";

/**
 * Плитка картки у списку.
 *
 * Свідомо без фотографії, хоча фото в картки може бути. Список — найчастіший
 * екран застосунку, і він має малюватися миттєво; фотографії ж лежать в
 * окремій таблиці саме для того, щоб їх не читати заради списку. Упізнаваність
 * дає колір: його видно з відстані й ще до того, як око встигло прочитати
 * назву.
 *
 * Плитку можна перетягнути, притримавши, — так задається порядок списку.
 *
 * Це кнопка, а не посилання, і причина не стилістична. Відпустивши картку
 * після перетягування, браузер усе одно надсилає `click`; dnd-kit його гасить,
 * але гасить лише поширення події — стандартний перехід за `href` при цьому
 * відбувається, і замість переставленої картки відкривався б її штрихкод.
 * Перехід тут робить обробник, тож гасити більше нічого не треба.
 */
export function CardTile({ card }: { card: Card }) {
  const navigate = useNavigate();
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <li
      data-testid="card-tile"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10" : undefined}
    >
      <button
        type="button"
        onClick={() => void navigate(`/card/${card.id}`)}
        // Атрибути доступності від dnd-kit навмисно не застосовуються: вони
        // вмикають перетягування з клавіатури на пробіл і Enter, а саме ними
        // кнопку відкривають.
        {...listeners}
        style={{
          backgroundColor: card.color,
          // Гортання сторінки має лишатися можливим: перетягування починається
          // лише після утримання, а до того жест належить браузеру.
          touchAction: "manipulation",
        }}
        className={`no-select flex aspect-[1.586/1] w-full flex-col justify-between rounded-3xl p-4 text-left text-ink ${
          isDragging
            ? "scale-105 shadow-2xl shadow-black/50"
            : "transition-transform active:scale-[0.97]"
        }`}
      >
        <span className="text-3xl font-bold opacity-30">{cardInitials(card.name)}</span>
        <span className="w-full">
          <span className="block truncate text-base leading-tight font-semibold">
            {card.name}
          </span>
          <span className="block text-xs opacity-60">{formatLabel(card.format)}</span>
        </span>
      </button>
    </li>
  );
}
