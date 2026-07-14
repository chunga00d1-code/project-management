import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, ResponsiveGrid } from "../../components/layout/PageLayout";
import { renderAtViewport } from "../../test/renderAtViewport";

describe("page layout primitives", () => {
  it("keeps page actions in a named wrapping region", () => {
    renderAtViewport(
      <PageHeader
        title="Nhiệm vụ"
        description="Theo dõi review"
        actions={<button>Tạo task</button>}
      />,
      320,
    );
    expect(screen.getByRole("heading", { name: "Nhiệm vụ" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Thao tác trang" })).toContainElement(
      screen.getByRole("button"),
    );
  });

  it("exposes a responsive grid without feature-specific breakpoints", () => {
    const { container } = renderAtViewport(
      <ResponsiveGrid minItemWidth="14rem">
        <div>A</div>
        <div>B</div>
      </ResponsiveGrid>,
      768,
    );
    expect(container.firstChild).toHaveStyle({ "--grid-min": "14rem" });
  });
});
