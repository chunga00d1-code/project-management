import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverflowText } from "../../components/data/OverflowText";
import { ResponsiveDataView, type DataColumn } from "../../components/data/ResponsiveDataView";
import { ResponsiveGrid } from "../../components/layout/PageLayout";
import "../../styles/primitives.css";
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

  it.each([375, 1024])("returns the supplied empty state at %ipx", (width) => {
    renderAtViewport(<ResponsiveDataView rows={[]} rowKey={(row: User) => row.id} columns={columns} empty={<p>Không có dữ liệu</p>} caption="Thành viên" />, width);
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

  it("handles a missing clipboard API as a copy failure", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    renderAtViewport(<OverflowText value="secret" copyable />, 375);
    await userEvent.click(screen.getByRole("button", { name: "Sao chép giá trị" }));
    expect(screen.getByRole("status")).toHaveTextContent("Không thể sao chép");
  });

  it("only announces the latest clipboard request result", async () => {
    let rejectFirst!: (reason: Error) => void;
    let resolveSecond!: () => void;
    const first = new Promise<void>((_, reject) => { rejectFirst = reject; });
    const second = new Promise<void>((resolve) => { resolveSecond = resolve; });
    const writeText = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderAtViewport(<OverflowText value="value" copyable />, 375);
    const button = screen.getByRole("button", { name: "Sao chép giá trị" });
    await userEvent.click(button);
    await userEvent.click(button);
    resolveSecond();
    await second;
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép"));
    rejectFirst(new Error("late failure"));
    await first.catch(() => undefined);
    expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép");
  });

  it("re-announces repeated identical outcomes", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    renderAtViewport(<OverflowText value="value" copyable />, 375);
    const button = screen.getByRole("button", { name: "Sao chép giá trị" });
    await userEvent.click(button);
    const firstStatus = screen.getByRole("status");
    await userEvent.click(button);
    expect(screen.getByRole("status")).not.toBe(firstStatus);
    expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép");
  });

  it("announces feedback under Strict Mode effect replay", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<StrictMode><OverflowText value="value" copyable /></StrictMode>);
    await userEvent.click(screen.getByRole("button", { name: "Sao chép giá trị" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép");
  });
  it("does not update feedback after unmount", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockReturnValue(pending) } });
    const view = render(<OverflowText value="value" copyable />);
    await userEvent.click(screen.getByRole("button", { name: "Sao chép giá trị" }));
    view.unmount();
    resolve();
    await expect(pending).resolves.toBeUndefined();
  });});

describe("repository overflow containment", () => {
  it("constrains a long unbroken repository inside a 320px grid card", () => {
    const repository = `owner/${"repository".repeat(40)}`;
    const { container } = renderAtViewport(
      <ResponsiveGrid minItemWidth="20rem">
        <article className="project-card">
          <div className="project-card__header">
            <div className="project-card__content"><OverflowText value={repository} /></div>
          </div>
        </article>
      </ResponsiveGrid>,
      320,
    );
    expect(container.querySelector(".responsive-grid")).toHaveStyle({ "--grid-min": "20rem" });
    expect(container.querySelector(".project-card__content")).toBeInTheDocument();
    const css = readFileSync("frontend/src/styles/primitives.css", "utf8");
    const projects = readFileSync("frontend/src/features/auth/Projects.tsx", "utf8");
    expect(css).toMatch(/\.project-card__content\s*\{[^}]*min-width:\s*0/);
    expect(projects).toContain('className="project-card__content" style={{ minWidth: 0 }}');
    expect(screen.getByTitle(repository)).toHaveClass("overflow-text");
  });
});