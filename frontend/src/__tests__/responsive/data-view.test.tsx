import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverflowText } from "../../components/data/OverflowText";
import { ResponsiveDataView, type DataColumn } from "../../components/data/ResponsiveDataView";
import { renderAtViewport } from "../../test/renderAtViewport";

afterEach(cleanup);

type User = { id: string; name: string; email: string; role: string };
const rows: User[] = [
  { id: "1", name: "An", email: "an@example.com", role: "Admin" },
  { id: "2", name: "Bình", email: "binh@example.com", role: "Member" },
];
const columns: DataColumn<User>[] = [
  { key: "name", header: "Tên", render: (row) => row.name, cardPriority: "primary" },
  { key: "email", header: "Email", render: (row) => row.email },
  { key: "role", header: "Vai trò", render: (row) => row.role },
];

describe("ResponsiveDataView", () => {
  it("renders a labelled semantic table on desktop", () => {
    renderAtViewport(<ResponsiveDataView rows={rows} rowKey={(row) => row.id} columns={columns} empty={<p>Trống</p>} caption="Thành viên" />, 1024);

    expect(screen.getByRole("table", { name: "Thành viên" })).toBeVisible();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Tên", "Email", "Vai trò"]);
  });

  it("renders labelled cards instead of a table on mobile", () => {
    renderAtViewport(<ResponsiveDataView rows={rows} rowKey={(row) => row.id} columns={columns} empty={<p>Trống</p>} caption="Thành viên" />, 375);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.querySelectorAll("dt")).toHaveLength(3);
      expect(card.querySelectorAll("dd")).toHaveLength(3);
    }
    expect(cards[0]).toHaveTextContent("TênAnEmailan@example.comVai tròAdmin");
  });

  it("returns the supplied empty state in either layout", () => {
    renderAtViewport(<ResponsiveDataView rows={[]} rowKey={(row: User) => row.id} columns={columns} empty={<p>Không có dữ liệu</p>} caption="Thành viên" />, 375);
    expect(screen.getByText("Không có dữ liệu")).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});

describe("OverflowText", () => {
  it("copies its value and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderAtViewport(<OverflowText value="owner/repository" copyable label="repository" />, 375);

    await userEvent.click(screen.getByRole("button", { name: "Sao chép repository" }));
    expect(writeText).toHaveBeenCalledWith("owner/repository");
    expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép");
  });

  it("announces clipboard failure without rejecting the click", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    renderAtViewport(<OverflowText value="secret" copyable />, 375);

    await expect(userEvent.click(screen.getByRole("button", { name: "Sao chép giá trị" }))).resolves.toBeUndefined();
    expect(screen.getByRole("status")).toHaveTextContent("Không thể sao chép");
  });
});
