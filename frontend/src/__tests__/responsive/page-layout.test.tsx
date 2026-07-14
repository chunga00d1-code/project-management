import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageContainer, PageHeader, ResponsiveGrid } from "../../components/layout/PageLayout";
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

  it("forwards standard attributes and class names to semantic page elements", () => {
    renderAtViewport(
      <>
        <PageHeader title="Thuộc tính" className="custom-header" id="page-heading" aria-describedby="page-help" />
        <PageContainer className="custom-page" id="page-content" aria-label="Nội dung chính">
          Content
        </PageContainer>
      </>,
      1024,
    );

    const header = screen.getByRole("heading", { name: "Thuộc tính" }).closest("header");
    expect(header).toHaveClass("page-header", "custom-header");
    expect(header).toHaveAttribute("id", "page-heading");
    expect(header).toHaveAttribute("aria-describedby", "page-help");
    expect(screen.getByRole("main", { name: "Nội dung chính" })).toHaveClass("page-container", "custom-page");
    expect(screen.getByRole("main", { name: "Nội dung chính" })).toHaveAttribute("id", "page-content");
  });
});
