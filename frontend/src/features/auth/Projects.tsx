import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
import { OverflowText } from "../../components/data/OverflowText";
import { ResponsiveGrid } from "../../components/layout/PageLayout";

export type ProjectRole = "owner" | "manager" | "member" | "viewer";
export type Project = {
  _id: string;
  name: string;
  description: string;
  members: { email: string; role: ProjectRole }[];
  repositoryFullName?: string;
  installationId?: number;
};

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const load = () => api<Project[]>("/projects")
    .then((items) => setProjects(items.filter((item) => item.repositoryFullName)))
    .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải repository"));

  useEffect(() => { void load(); }, []);
  useRealtimeRefresh(["project."], () => void load());

  return (
    <main>
      <header>
        <div>
          <h2>Repository GitHub</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: ".35rem" }}>Danh sách được đồng bộ tự động khi GitHub App được cài vào repository.</p>
        </div>
      </header>
      {error && <div className="error-message" style={{ margin: "1rem 0" }}>{error}</div>}
      <ResponsiveGrid minItemWidth="20rem" style={{ marginTop: "1.5rem" }}>
        {projects.map((project) => (
          <article key={project._id} className="project-card" style={{ margin: 0 }}>
            <div className="project-card__header">
              <div className="project-card__content" style={{ minWidth: 0 }}>
                <span className="pill">Đồng bộ bởi GitHub App</span>
                <h3 style={{ marginTop: ".75rem" }}><OverflowText value={project.repositoryFullName ?? ""} copyable label="repository" /></h3>
              </div>
              <span aria-label="Đã kết nối" title="Đã kết nối GitHub">●</span>
            </div>
            <p style={{ color: "var(--text-secondary)", marginTop: ".75rem" }}>{project.description || "Repository được quản lý từ GitHub."}</p>
            {project.installationId && <small style={{ display: "block", marginTop: "1rem", color: "var(--text-muted)" }}>Installation #{project.installationId}</small>}
          </article>
        ))}
        {!projects.length && <div className="empty-state"><h3>Chưa có repository</h3><p>Cài ReviewGrid GitHub App vào repository để bắt đầu giao việc.</p></div>}
      </ResponsiveGrid>
    </main>
  );
}
