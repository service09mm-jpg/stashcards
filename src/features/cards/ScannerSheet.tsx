import { useEffect, useRef, useState } from "react";
import { createScanner, type ScanHit } from "@/lib/scanner";
import { Button } from "@/ui/Button";

/**
 * Сканування картки камерою.
 *
 * Кадри розпізнаються не в кожному кадрі відео, а раз на `SCAN_INTERVAL_MS`.
 * Це навмисно: розпізнавання — найважча операція в застосунку, і якщо
 * запускати її безперервно, прев'ю починає смикатися, телефон гріється, а
 * шансів упіймати код більше не стає — людині все одно потрібні частки
 * секунди, щоб навести камеру.
 */
const SCAN_INTERVAL_MS = 220;

type Props = {
  onDetect: (hit: ScanHit) => void;
  onClose: () => void;
};

type Status =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "failed"; message: string };

export function ScannerSheet({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "starting" });

  // Колбек тримаємо в ref, щоб ефект із камерою не перезапускався щоразу, коли
  // батьківський компонент перемалювався: перезапуск означав би вимкнути й
  // знову ввімкнути камеру просто посеред наведення.
  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Задня камера й висока роздільність: дрібні штрихи EAN з фронтальної
          // камери телефона зазвичай не читаються взагалі.
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const scanner = await createScanner();
        if (stopped) return;
        setStatus({ kind: "scanning" });

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const hit = await scanner.scan(videoRef.current);
            if (hit && !stopped) {
              stopped = true;
              // Коротка вібрація — єдиний спосіб сказати «спіймав», коли
              // людина дивиться не на екран, а на картку в руці.
              navigator.vibrate?.(60);
              onDetectRef.current(hit);
              return;
            }
          } catch {
            // Окремий кадр міг не розпізнатися з будь-якої причини — це
            // нормальний хід речей, наступна спроба за мить.
          }
          timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };

        void tick();
      } catch (error) {
        if (!stopped) setStatus({ kind: "failed", message: cameraError(error) });
      }
    };

    void start();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      // Доріжки треба зупиняти руками: інакше індикатор камери лишається
      // горіти, навіть коли сканер уже закрито.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        // Без `playsInline` Safari на iPhone розгортає відео на весь екран
        // власним програвачем, і про сканування можна забути.
        playsInline
        muted
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        {status.kind === "failed" ? (
          <p className="max-w-xs rounded-2xl bg-surface/90 p-4 text-center text-sm">
            {status.message}
          </p>
        ) : (
          <>
            {/* Рамка не обрізає кадр — розпізнається весь екран. Вона лише
                підказує, куди зручно навести картку. */}
            <div className="aspect-[1.586/1] w-full max-w-sm rounded-3xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
            <p className="mt-6 text-center text-sm text-white/70">
              {status.kind === "starting"
                ? "Вмикаємо камеру…"
                : "Наведіть на штрихкод картки"}
            </p>
          </>
        )}
      </div>

      <div className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button variant="ghost" onClick={onClose} className="w-full">
          Ввести код руками
        </Button>
      </div>
    </div>
  );
}

function cameraError(error: unknown): string {
  if (!window.isSecureContext) {
    return "Камера доступна лише через HTTPS. Відкрийте застосунок за захищеним посиланням.";
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Доступ до камери заборонено. Дозвольте його в налаштуваннях браузера — або введіть код руками.";
    }
    if (error.name === "NotFoundError") {
      return "Камери не знайдено. Код можна ввести руками.";
    }
  }
  return "Не вдалося ввімкнути камеру. Код можна ввести руками.";
}
