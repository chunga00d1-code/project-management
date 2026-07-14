// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAtViewport } from "../../test/renderAtViewport";
import { Overview } from "../../features/overview/Overview";
import { Projects } from "../../features/auth/Projects";
import { Users } from "../../features/auth/Users";
import { Operations } from "../../features/auth/Operations";
import { Settings } from "../../features/auth/Settings";

const apiMock = vi.fn();
vi.mock("../../api/client", () => ({ api: (...args: unknown[]) => apiMock(...args) }));
vi.mock("../../realtime/useRealtimeRefresh", () => ({ useRealtimeRefresh: vi.fn() }));
vi.mock("../../features/tasks/ServerDashboard", () => ({ ServerDashboard: () => <div data-testid="server-dashboard" /> }));

type Resolver<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void };
const deferred = <T,>(): Resolver<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

const assertLandmarks = (title: RegExp) => {
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getAllByRole("heading", { level: 1, name: title })).toHaveLength(1);
};

const project = { _id: "p1", name: "ReviewGrid", description: "Project", members: [], repositoryFullName: "owner/repo", installationId: 7 };
const user = { id: "u1", email: "member@example.com", role: "developer", active: true, createdAt: "2026-01-01" };
const audit = { _id: "a1", at: "2026-01-01T00:00:00Z", actor: "admin", action: "updated", target: "task" };
const job = { _id: "j1", type: "notify", payload: { repository: "owner/repo", number: 4 }, attempts: 1, lastError: "failed" };
const realtime = { enabled: true, redisConnected: true, activeConnections: 1, publishedEvents: 2, receivedEvents: 2, publishFailures: 0 };

const mockOperations = (values: unknown[]) => {
  apiMock.mockImplementation((path: string) => {
    if (path === "/operations/audit") return Promise.resolve(values[0]);
    if (path === "/operations/dead-letter") return Promise.resolve(values[1]);
    if (path === "/operations/realtime") return Promise.resolve(values[2]);
    throw new Error(`Unexpected API ${path}`);
  });
};

afterEach(() => { cleanup(); apiMock.mockReset(); });

describe("workspace screens render real responsive landmarks", () => {
  it.each([320, 1440])("renders Projects landmarks at %ipx", async (width) => {
    apiMock.mockResolvedValue([project]);
    renderAtViewport(<Projects />, width);
    assertLandmarks(/Repository GitHub/i);
    await screen.findByText("owner/repo");
  });

  it.each([320, 1440])("renders Overview landmarks at %ipx", async (width) => {
    apiMock.mockImplementation((path: string) => Promise.resolve(path === "/projects" ? [project] : []));
    renderAtViewport(<Overview onNavigate={vi.fn()} />, width);
    assertLandmarks(/Tổng quan/i);
    await screen.findByText("ReviewGrid");
  });

  it.each([320, 1440])("renders Users with a named page action group at %ipx", async (width) => {
    apiMock.mockResolvedValue([user]);
    renderAtViewport(<Users />, width);
    assertLandmarks(/Quản Lý Thành Viên/i);
    expect(screen.getByRole("group", { name: /Thao tác trang/i })).toBeVisible();
    await screen.findByText("member@example.com");
  });

  it.each([320, 1440])("renders Operations landmarks at %ipx", async (width) => {
    mockOperations([{ items: [audit] }, [job], realtime]);
    renderAtViewport(<Operations />, width);
    assertLandmarks(/Bảng Vận Hành Hệ Thống/i);
    await screen.findByText("updated");
  });

  it.each([320, 1440])("renders Settings landmarks at %ipx", async (width) => {
    apiMock.mockResolvedValue({ smtpHost: "smtp.example.com" });
    renderAtViewport(<Settings />, width);
    assertLandmarks(/Cấu Hình Hệ Thống/i);
    expect(await screen.findByDisplayValue("smtp.example.com")).toBeVisible();
  });
});

describe("workspace collection state machines", () => {
  it("Projects renders loading, then empty, without overlapping states", async () => {
    const request = deferred<unknown[]>(); apiMock.mockReturnValue(request.promise);
    renderAtViewport(<Projects />, 320);
    expect(screen.getByRole("status", { name: /đang tải/i })).toBeVisible();
    expect(screen.queryByText(/Chưa có repository/i)).not.toBeInTheDocument();
    request.resolve([]);
    expect(await screen.findByText(/Chưa có repository/i)).toBeVisible();
    expect(screen.queryByRole("status", { name: /đang tải/i })).not.toBeInTheDocument();
  });

  it("Projects renders only load error after rejection", async () => {
    apiMock.mockRejectedValue(new Error("projects unavailable"));
    renderAtViewport(<Projects />, 1440);
    expect(await screen.findByRole("alert")).toHaveTextContent("projects unavailable");
    expect(screen.queryByText(/Chưa có repository/i)).not.toBeInTheDocument();
  });

  it("Overview renders loading, then successful empty content", async () => {
    const tasks = deferred<unknown[]>(); const projects = deferred<unknown[]>();
    apiMock.mockImplementation((path: string) => path === "/tasks" ? tasks.promise : projects.promise);
    renderAtViewport(<Overview onNavigate={vi.fn()} />, 320);
    expect(screen.getByRole("status", { name: /đang tải/i })).toBeVisible();
    expect(screen.queryByTestId("server-dashboard")).not.toBeInTheDocument();
    tasks.resolve([]); projects.resolve([]);
    expect(await screen.findByTestId("server-dashboard")).toBeVisible();
    expect(screen.getByText(/Chưa có dự án nào/i)).toBeVisible();
  });

  it("Overview renders only load error after rejection", async () => {
    apiMock.mockRejectedValue(new Error("overview unavailable"));
    renderAtViewport(<Overview onNavigate={vi.fn()} />, 1440);
    expect(await screen.findByRole("alert")).toHaveTextContent("overview unavailable");
    expect(screen.queryByTestId("server-dashboard")).not.toBeInTheDocument();
  });

  it.each([320, 1440])("Users renders cards on mobile and a table on desktop after load at %ipx", async (width) => {
    apiMock.mockResolvedValue([user]); renderAtViewport(<Users />, width);
    await screen.findByText("member@example.com");
    if (width === 320) { expect(screen.queryByRole("table")).not.toBeInTheDocument(); expect(screen.getByRole("article")).toBeVisible(); }
    else expect(screen.getByRole("table", { name: /Danh sách thành viên/i })).toBeVisible();
  });

  it("Users renders only load error after rejection", async () => {
    apiMock.mockRejectedValue(new Error("users unavailable")); renderAtViewport(<Users />, 1440);
    expect(await screen.findByRole("alert")).toHaveTextContent("users unavailable");
    expect(screen.queryByText(/Chưa có thành viên/i)).not.toBeInTheDocument();
  });

  it.each([320, 1440])("Operations renders cards on mobile and tables on desktop after load at %ipx", async (width) => {
    mockOperations([{ items: [audit] }, [job], realtime]); renderAtViewport(<Operations />, width);
    await screen.findByText("updated");
    if (width === 320) { expect(screen.queryByRole("table")).not.toBeInTheDocument(); expect(screen.getAllByRole("article")).toHaveLength(2); }
    else expect(screen.getAllByRole("table")).toHaveLength(2);
  });

  it("Operations renders only load error after rejection", async () => {
    apiMock.mockRejectedValue(new Error("operations unavailable")); renderAtViewport(<Operations />, 1440);
    expect(await screen.findByRole("alert")).toHaveTextContent("operations unavailable");
    expect(screen.queryByText(/Không có job nào/i)).not.toBeInTheDocument();
  });


  it("Users renders loading, then successful empty state exclusively", async () => {
    const request = deferred<unknown[]>(); apiMock.mockReturnValue(request.promise);
    renderAtViewport(<Users />, 320);
    expect(screen.getByRole("status", { name: /đang tải/i })).toBeVisible();
    expect(screen.queryByText(/Chưa có thành viên/i)).not.toBeInTheDocument();
    request.resolve([]);
    expect(await screen.findByText(/Chưa có thành viên/i)).toBeVisible();
    expect(screen.queryByRole("status", { name: /đang tải/i })).not.toBeInTheDocument();
  });

  it("Operations renders loading, then both successful empty views exclusively", async () => {
    const auditRequest = deferred<{ items: unknown[] }>();
    const jobsRequest = deferred<unknown[]>();
    const realtimeRequest = deferred<typeof realtime>();
    apiMock.mockImplementation((path: string) => path === "/operations/audit" ? auditRequest.promise : path === "/operations/dead-letter" ? jobsRequest.promise : realtimeRequest.promise);
    renderAtViewport(<Operations />, 1440);
    expect(screen.getByRole("status", { name: /đang tải/i })).toBeVisible();
    expect(screen.queryByText(/Không có job nào/i)).not.toBeInTheDocument();
    auditRequest.resolve({ items: [] }); jobsRequest.resolve([]); realtimeRequest.resolve(realtime);
    expect(await screen.findByText(/Không có job nào/i)).toBeVisible();
    expect(screen.getByText(/Chưa có nhật ký/i)).toBeVisible();
    expect(screen.queryByRole("status", { name: /đang tải/i })).not.toBeInTheDocument();
  });
  it("Settings renders loading then content, and only error after rejection", async () => {
    const request = deferred<Record<string, unknown>>(); apiMock.mockReturnValue(request.promise);
    const view = renderAtViewport(<Settings />, 320);
    expect(screen.getByRole("status", { name: /đang tải/i })).toBeVisible();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    request.resolve({ smtpHost: "smtp.example.com" });
    expect(await screen.findByDisplayValue("smtp.example.com")).toBeVisible();
    view.unmount(); apiMock.mockRejectedValue(new Error("settings unavailable"));
    renderAtViewport(<Settings />, 1440);
    expect(await screen.findByRole("alert")).toHaveTextContent("settings unavailable");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
describe("workspace CSS ownership", () => {
  it("does not retain orphan legacy dashboard or workload grid selectors", () => {
    const css = readFileSync("frontend/src/styles/features.css", "utf8");
    expect(css).not.toMatch(/\.dashboard-grid/);
    expect(css).not.toMatch(/\.workload-grid/);
    expect(css).toContain(".workload-details .workload-panels p");
  });
});