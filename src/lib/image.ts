/**
 * Максимальна сторона збереженого знімка.
 *
 * Камера телефона знімає 12 мегапікселів, це 3–5 МБ на фото. Знімок картки
 * потрібен лише для того, щоб її можна було показати касиру очима, і 1280
 * точок для цього більш ніж достатньо. Різниця суттєва: сховище браузера не
 * безмежне, а ще ці самі знімки цілком потрапляють у файл резервної копії.
 */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.82;

/**
 * Зменшення знімка перед збереженням.
 *
 * Якщо з якоїсь причини стиснути не вдалося, повертаємо оригінал: краще
 * зберегти важке фото, ніж не зберегти жодного.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 400_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    return blob ?? file;
  } catch {
    return file;
  }
}
