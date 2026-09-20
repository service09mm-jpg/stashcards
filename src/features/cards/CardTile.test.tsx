import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  lastUsedAt: 0,
  usageCount: 0,
};

function renderTile(overrides: Partial<Card> = {}) {
  render(
    <MemoryRouter>
      <CardTile card={{ ...card, ...overrides }} />
    </MemoryRouter>,
  );
}

describe("плитка картки", () => {
  it("веде на екран картки", () => {
    renderTile();

    expect(screen.getByRole("link")).toHaveAttribute("href", "/card/abc");
  });

  it("показує назву й тип коду", () => {
    renderTile();

    expect(screen.getByText("Нова Пошта")).toBeInTheDocument();
    expect(screen.getByText("EAN-13")).toBeInTheDocument();
  });

  it("фарбується кольором картки — за ним її й шукають очима", () => {
    renderTile({ color: "#f472b6" });

    expect(screen.getByRole("link")).toHaveStyle({ backgroundColor: "#f472b6" });
  });
});
