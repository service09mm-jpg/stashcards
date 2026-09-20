import { describe, expect, it } from "vitest";
import { CARD_COLORS, cardInitials, nextColor } from "./card";

describe("ініціали на плитці", () => {
  it("бере перші літери двох слів", () => {
    expect(cardInitials("Нова Пошта")).toBe("НП");
  });

  it("з одного слова бере дві перші літери", () => {
    expect(cardInitials("Сільпо")).toBe("СІ");
  });

  it("не спотикається об зайві пробіли", () => {
    expect(cardInitials("  Нова   Пошта  ")).toBe("НП");
  });

  it("щось показує навіть для порожньої назви", () => {
    expect(cardInitials("   ")).toBe("?");
  });
});

describe("колір нової картки", () => {
  it("уникає кольорів, які вже є в списку", () => {
    const used = [CARD_COLORS[0], CARD_COLORS[1]];

    expect(used).not.toContain(nextColor(used));
  });

  it("починає коло спочатку, коли палітра вичерпана", () => {
    // Дублікати неминучі, щойно карток більше за кольорів; головне — не
    // впасти й видати щось із палітри.
    expect(CARD_COLORS).toContain(nextColor([...CARD_COLORS]));
  });
});
