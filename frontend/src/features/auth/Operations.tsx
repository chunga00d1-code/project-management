import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { OverflowText } from "../../components/data/OverflowText";
import { ResponsiveDataView, type DataColumn } from "../../components/data/ResponsiveDataView";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
import { PageContainer, PageHeader, ResponsiveGrid } from "../../components/layout/PageLayout";

type Audit = { _id: string; at: string; actor?: string; action: string; target: string };
type RealtimeStats = { enabled: boolean; redisConnected: boolean; activeConnections: number; publishedEvents: number; receivedEvents: number; publishFailures: number };
type Dead = { _id: string; type: string; attempts: number; lastError?: string; payload: { repository: string; number: number } };

export function Operations() {
  const [audit, setAudit] = useState<Audit[]>([]);
  const [jobs, setJobs] = useState<Dead[]>([]);
  const [error, setError] = useState("");
  const [realtime, setRealtime] = useState<RealtimeStats>();
  const load = useCallback(() => Promise.all([api<{ items: Audit[] }>("/operations/audit"), api<Dead[]>("/operations/dead-letter"), api<RealtimeStats>("/operations/realtime")]).then(([a, j, realtimeValue]) => { setAudit(a.items); setJobs(j); setRealtime(realtimeValue); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  useRealtimeRefresh(["operations.", "notification."], () => void load());

  const jobColumns = useMemo<DataColumn<Dead>[]>(() => [
    { key: "type", header: "Loại", cardPriority: "primary", render: (job) => <span className="pill">{job.type}</span> },
    { key: "repository", header: "Kho mã nguồn", render: (job) => <OverflowText value={job.payload.repository} copyable label="repository" /> },
    { key: "pr", header: "PR", render: (job) => `#${job.payload.number}` },
    { key: "attempts", header: "Số lần thử", render: (job) => job.attempts },
    { key: "error", header: "Lỗi", render: (job) => job.lastError ? <OverflowText value={job.lastError} copyable label="lỗi" /> : "—" },
    { key: "retry", header: "Thao tác", render: (job) => <button className="btn-primary" onClick={async () => { await api(`/operations/dead-letter/${job._id}/retry`, { method: "POST" }); void load(); }}>🔄 Thực hiện lại (Retry)</button> },
  ], [load]);
  const auditColumns = useMemo<DataColumn<Audit>[]>(() => [
    { key: "at", header: "Thời gian", render: (item) => new Date(item.at).toLocaleString("vi-VN") },
    { key: "actor", header: "Người thực hiện", render: (item) => item.actor || "hệ thống" },
    { key: "action", header: "Hành động", cardPriority: "primary", render: (item) => <strong>{item.action}</strong> },
    { key: "target", header: "Đối tượng", render: (item) => <OverflowText value={item.target} copyable label="đối tượng" /> },
  ], []);

  return <PageContainer>
    <PageHeader title="Bảng Vận Hành Hệ Thống" />
    {error && <div className="error-message" style={{ margin: "1rem 0" }}>{error}</div>}
    {realtime && <ResponsiveGrid minItemWidth="12rem" className="kpi-grid"><div className="dashboard-card"><span className="label">SSE đang kết nối</span><span className="value">{realtime.activeConnections}</span></div><div className="dashboard-card"><span className="label">Event đã phát</span><span className="value">{realtime.publishedEvents}</span></div><div className="dashboard-card"><span className="label">Redis Pub/Sub</span><span className="value" style={{ color: realtime.redisConnected ? "#4ade80" : "#fb923c" }}>{realtime.redisConnected ? "ON" : "LOCAL"}</span></div><div className="dashboard-card danger"><span className="label">Publish lỗi</span><span className="value">{realtime.publishFailures}</span></div></ResponsiveGrid>}
    <section className="stack"><h3>⚠️ Hàng Đợi Thất Bại (Dead Letter Queue)</h3><ResponsiveDataView rows={jobs} rowKey={(job) => job._id} columns={jobColumns} caption="Hàng đợi thất bại" empty={<p className="empty-state">Không có job nào thất bại. Hệ thống vận hành tốt!</p>} /></section>
    <section className="stack"><h3>📜 Nhật Ký Hoạt Động (Audit Log)</h3><ResponsiveDataView rows={audit} rowKey={(item) => item._id} columns={auditColumns} caption="Nhật ký hoạt động" empty={<p className="empty-state">Chưa có nhật ký hoạt động nào.</p>} /></section>
  </PageContainer>;
}