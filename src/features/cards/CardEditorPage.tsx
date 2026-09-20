import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useParams } from "react-router";
import { renderBarcode } from "@/lib/barcode";
import {
  BARCODE_FORMATS,
  formatLabel,
  guessFormat,
  normalizeCode,
  validateCode,
  type BarcodeFormat,
} from "@/lib/barcodeFormats";
import { CARD_COLORS, nextColor } from "@/lib/card";
import { createCard, deleteCard, getCard, getPhotos, listCards, setPhoto, updateCard } from "@/lib/db";
import { shrinkImage } from "@/lib/image";
import type { ScanHit } from "@/lib/scanner";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { BackIcon, CameraIcon, TrashIcon } from "@/ui/icons";
import { ScannerSheet } from "./ScannerSheet";

type Props = { mode: "create" | "edit" };

/**
 * Створення й редагування картки — один екран на обидва випадки: поля,
 * перевірки й попередній перегляд у них однакові, а відмінність зводиться до
 * того, звідки беруться початкові значення й що робить кнопка збереження.
 */
export function CardEditorPage({ mode }: Props) {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const existing = useLiveQuery(() => (mode === "edit" ? getCard(id) : null), [mode, id]);
  const existingPhotos = useLiveQuery(
    () => (mode === "edit" ? getPhotos(id) : undefined),
    [mode, id],
  );
  const cards = useLiveQuery(listCards, []);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [format, setFormat] = useState<BarcodeFormat>("code_128");
  const [color, setColor] = useState<string>(CARD_COLORS[0]);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Сканер відкривається одразу при створенні картки: у переважній більшості
  // випадків людина натиснула «+» саме для того, щоб піднести телефон до
  // штрихкоду, і зайвий екран між цими двома діями — марна затримка.
  const [scanning, setScanning] = useState(mode === "create");

  // Знімки, зроблені до того, як картка збережена, нікуди покласти — картки
  // ще немає. Тому вони чекають тут і записуються одразу після створення.
  const [pendingPhotos, setPendingPhotos] = useState<{ front?: Blob; back?: Blob }>({});

  /**
   * Чи вибирав юзер тип коду руками. Доки ні — тип підбирається за самим
   * кодом; щойно вибрав, здогадка мовчить, щоб не перебивати свідомий вибір.
   */
  const formatTouched = useRef(false);

  const filled = useRef(false);
  useEffect(() => {
    if (mode !== "edit" || !existing || filled.current) return;
    filled.current = true;
    setName(existing.name);
    setCode(existing.code);
    setFormat(existing.format);
    setColor(existing.color);
    setNote(existing.note);
  }, [mode, existing]);

  // Колір нової картки підбирається так, щоб не повторювати вже наявні, —
  // інакше список швидко стає однорідним і в ньому нічого не видно.
  const pickedColor = useRef(false);
  useEffect(() => {
    if (mode !== "create" || pickedColor.current || !cards) return;
    pickedColor.current = true;
    setColor(nextColor(cards.map((card) => card.color)));
  }, [mode, cards]);

  const normalized = useMemo(() => normalizeCode(format, code), [format, code]);
  const codeError = code.length > 0 ? validateCode(format, normalized) : null;
  const preview = useMemo(
    () => (codeError || !normalized ? null : renderBarcode(format, normalized)),
    [codeError, format, normalized],
  );

  const nameError = touched && name.trim().length === 0 ? "Без назви картку не знайти" : null;
  const canSave = name.trim().length > 0 && normalized.length > 0 && !codeError;

  const onScan = (hit: ScanHit) => {
    setCode(hit.code);
    // Формат приходить від сканера, тож він точний — гадати за виглядом коду
    // тут не треба й не можна.
    setFormat(hit.format);
    setScanning(false);
  };

  const save = async () => {
    setTouched(true);
    if (!canSave) return;

    const draft = { name: name.trim(), code: normalized, format, color, note: note.trim() };

    if (mode === "edit") {
      await updateCard(id, draft);
      navigate(`/card/${id}`, { replace: true });
      return;
    }

    const card = await createCard(draft);
    if (pendingPhotos.front) await setPhoto(card.id, "front", pendingPhotos.front);
    if (pendingPhotos.back) await setPhoto(card.id, "back", pendingPhotos.back);
    navigate(`/card/${card.id}`, { replace: true });
  };

  const remove = async () => {
    await deleteCard(id);
    navigate("/", { replace: true });
  };

  const attachPhoto = async (side: "front" | "back", file: File) => {
    const blob = await shrinkImage(file);
    if (mode === "edit") await setPhoto(id, side, blob);
    else setPendingPhotos((current) => ({ ...current, [side]: blob }));
  };

  if (scanning) {
    return <ScannerSheet onDetect={onScan} onClose={() => setScanning(false)} />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface"
        >
          <BackIcon />
        </button>
        <h1 className="text-lg font-semibold">
          {mode === "create" ? "Нова картка" : "Змінити картку"}
        </h1>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-8">
        <Field
          label="Назва"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Сільпо, Аптека, спортзал…"
          error={nameError}
          autoComplete="off"
          enterKeyHint="next"
        />

        <Field
          label="Код"
          value={code}
          onChange={(event) => {
            const next = event.target.value;
            setCode(next);
            // Формат вгадуємо лише поки юзер не чіпав список сам: інакше
            // здогадка перебивала б свідомий вибір.
            if (mode === "create" && !formatTouched.current) setFormat(guessFormat(next));
          }}
          placeholder="4820000000000"
          error={codeError}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          action={
            <button
              type="button"
              onClick={() => setScanning(true)}
              aria-label="Сканувати код"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-text active:bg-surface-2"
            >
              <CameraIcon />
            </button>
          }
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Тип коду</span>
          <select
            value={format}
            onChange={(event) => {
              formatTouched.current = true;
              setFormat(event.target.value as BarcodeFormat);
            }}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-text outline-none focus:border-muted"
          >
            {BARCODE_FORMATS.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <ColorPicker value={color} onChange={setColor} />

        <Field
          label="Нотатка"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Наприклад, пароль або знижка"
          autoComplete="off"
        />

        <PhotoRow
          label="Лицьовий бік"
          has={Boolean(existingPhotos?.front ?? pendingPhotos.front)}
          onPick={(file) => void attachPhoto("front", file)}
          onClear={mode === "edit" ? () => void setPhoto(id, "front", undefined) : undefined}
        />
        <PhotoRow
          label="Зворотний бік"
          has={Boolean(existingPhotos?.back ?? pendingPhotos.back)}
          onPick={(file) => void attachPhoto("back", file)}
          onClear={mode === "edit" ? () => void setPhoto(id, "back", undefined) : undefined}
        />

        {/*
          Попередній перегляд — не прикраса. Він показує той самий код, який
          побачить сканер каси, ще до збереження: одруківку в номері видно
          одразу, а не біля каси з чергою за спиною.
        */}
        {preview?.ok && (
          <div className="rounded-2xl bg-white p-3">
            <div
              className="[&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: preview.svg }}
            />
          </div>
        )}

        {mode === "edit" && (
          <div className="pt-2">
            {confirmingDelete ? (
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => void remove()} className="flex-1">
                  <TrashIcon className="size-5" />
                  Так, видалити
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1"
                >
                  Скасувати
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                onClick={() => setConfirmingDelete(true)}
                className="w-full"
              >
                <TrashIcon className="size-5" />
                Видалити картку
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button onClick={() => void save()} disabled={!canSave} className="w-full">
          Зберегти
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted">Колір</span>
      <div className="flex flex-wrap gap-2">
        {CARD_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Колір ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={`size-11 rounded-full transition-transform active:scale-90 ${
              value === color ? "ring-2 ring-text ring-offset-2 ring-offset-ink" : ""
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

function PhotoRow({
  label,
  has,
  onPick,
  onClear,
}: {
  label: string;
  has: boolean;
  onPick: (file: File) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {has && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 px-3 text-sm text-danger active:opacity-60"
          >
            Прибрати
          </button>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-surface px-4 text-sm font-medium active:bg-surface-2">
          <CameraIcon className="size-5" />
          {has ? "Замінити" : "Зняти"}
          <input
            type="file"
            accept="image/*"
            // `capture` відкриває одразу камеру замість галереї — знімок
            // картки в руці роблять тут же, а не шукають у фотоплівці.
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
              // Скидаємо значення, щоб повторний вибір того самого файла
              // знову викликав подію.
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
