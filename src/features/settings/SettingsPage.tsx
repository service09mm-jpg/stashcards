import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  type ImportReport,
} from "@/lib/backup";
import { listCards, requestPersistentStorage } from "@/lib/db";
import { saveFile } from "@/lib/platform";
import { useBack } from "@/lib/useBack";
import { Button } from "@/ui/Button";
import { BackIcon, DownloadIcon, UploadIcon } from "@/ui/icons";

type Message = { kind: "ok" | "error"; text: string } | null;

export function SettingsPage() {
  const cards = useLiveQuery(listCards, []);
  const goBack = useBack();
  const [message, setMessage] = useState<Message>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const exportCards = async () => {
    try {
      const backup = await createBackup();
      const file = new File([JSON.stringify(backup, null, 2)], backupFileName(), {
        type: "application/json",
      });
      await saveFile(file);
      setMessage({ kind: "ok", text: `Збережено карток: ${backup.cards.length}` });
    } catch {
      setMessage({ kind: "error", text: "Не вдалося створити копію" });
    }
  };

  const importCards = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if ("error" in parsed) {
      setMessage({ kind: "error", text: parsed.error });
      return;
    }
    const report = await restoreBackup(parsed.cards);
    setMessage({ kind: "ok", text: describeImport(report) });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Назад"
          className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface"
        >
          <BackIcon />
        </button>
        <h1 className="text-lg font-semibold">Налаштування</h1>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-5 pb-10">
        <section>
          <h2 className="text-sm font-semibold text-muted">Резервна копія</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Картки зберігаються лише на цьому пристрої й нікуди не надсилаються.
            Це найшвидше й найприватніше, але має зворотний бік: видалення
            застосунку або очищення даних браузера стирає їх остаточно. Копія —
            єдиний спосіб цього уникнути, а також перенести картки на інший
            телефон.
          </p>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => void exportCards()} className="flex-1">
              <DownloadIcon className="size-5" />
              Зберегти
            </Button>
            <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface px-5 text-base font-medium active:bg-surface-2">
              <UploadIcon className="size-5" />
              Відновити
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importCards(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-muted">
            Відновлення не створює дублікатів: картки зіставляються за
            ідентифікатором, і з двох версій лишається новіша. Копію можна
            вливати скільки завгодно разів.
          </p>

          {message && (
            <p
              className={`mt-3 text-sm ${message.kind === "error" ? "text-danger" : "text-text"}`}
              role="status"
            >
              {message.text}
            </p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted">Сховище</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Карток</dt>
              <dd>{cards?.length ?? "…"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Захищене від очищення</dt>
              <dd>{persisted === null ? "невідомо" : persisted ? "так" : "ні"}</dd>
            </div>
          </dl>

          {persisted === false && (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Браузер вважає ці дані тимчасовими й може стерти їх, коли на
                пристрої закінчиться місце.
              </p>
              <Button
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => void requestPersistentStorage().then(setPersisted)}
              >
                Попросити захист
              </Button>
            </>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted">Про застосунок</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            StashCards працює повністю офлайн: після першого відкриття він не
            звертається до мережі взагалі. Штрихкоди малюються на самому
            пристрої, сканування теж відбувається тут — жоден номер картки не
            залишає телефон.
          </p>
        </section>
      </div>
    </div>
  );
}

function describeImport({ added, updated, skipped }: ImportReport): string {
  const parts = [`додано ${added}`, `оновлено ${updated}`];
  if (skipped > 0) parts.push(`пропущено ${skipped}`);
  return `Готово: ${parts.join(", ")}`;
}
