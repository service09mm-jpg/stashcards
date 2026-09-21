import { DndContext, useSensors } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/card";
import { CardTile } from "./CardTile";

const card: Card = {
  id: "abc",
  name: "Нова Пошта",
  code: "4006381333931",
  format: "ean_13",
  color: "#60a5fa",
  note: "",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  position: 0,
};

/** Показує поточну адресу — інакше перехід із кнопки нічим не перевірити. */
function CurrentPath() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

/**
 * Оточення плитки без жодного сенсора перетягування.
 *
 * `DndContext` без налаштувань вмикає власні сенсори за замовчуванням, і вони
 * вважають перетягуванням будь-яке натискання — у застосунку сенсор
 * налаштований інакше, з утриманням. Перевіряємо тут саму плитку, тож
 * перетягування вимкнене повністю.
 */
function Stage({ card }: { card: Card }) {
  return (
    <DndContext sensors={useSensors()}>
      <SortableContext items={[card.id]}>
        <ul>
          <CardTile card={card} />
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function renderTile(overrides: Partial<Card> = {}) {
  const tile = { ...card, ...overrides };

  render(
    <MemoryRouter>
      <Stage card={tile} />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe("плитка картки", () => {
  it("веде на екран картки", async () => {
    renderTile();

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByTestId("where")).toHaveTextContent("/card/abc");
  });

  it("показує назву й тип коду", () => {
    renderTile();

    expect(screen.getByText("Нова Пошта")).toBeInTheDocument();
    expect(screen.getByText("EAN-13")).toBeInTheDocument();
  });

  it("фарбується кольором картки — за ним її й шукають очима", () => {
    renderTile({ color: "#f472b6" });

    expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: "#f472b6" });
  });

  it("не перехоплює гортання сторінки до початку перетягування", () => {
    renderTile();

    expect(screen.getByRole("button")).toHaveStyle({ touchAction: "manipulation" });
  });
});
