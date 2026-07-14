import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Task } from "../../types";
import type { Project } from "../auth/Projects";
import { Overlay } from "../../components/overlay/Overlay";

type Collaborator = { login: string; name?: string; avatarUrl: string };

const labelStyle = { display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" };

export function CreateTask({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [createdCode, setCreatedCode] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [labels, setLabels] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [collaboratorsError, setCollaboratorsError] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  useEffect(() => {
    void api<Project[]>("/projects").then((items) => {
      const linked = items.filter((item) => item.repositoryFullName);
      setProjects(linked);
      if (linked.length) setProjectId((current) => current || linked[0]._id);
    });
  }, []);

  useEffect(() => {
    setAssignee("");
    setAssigneeOpen(false);
    setCollaborators([]);
    setCollaboratorsError("");
    if (!projectId) return;
    let active = true;
    setCollaboratorsLoading(true);
    void api<Collaborator[]>(`/projects/${projectId}/collaborators`)
      .then((items) => { if (active) setCollaborators(items); })
      .catch((error: unknown) => {
        if (active) setCollaboratorsError(error instanceof Error ? error.message : "Không thể tải thành viên repository từ GitHub");
      })
      .finally(() => { if (active) setCollaboratorsLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  const project = projects.find((item) => item._id === projectId);
  const selectedCollaborator = collaborators.find((item) => item.login === assignee);
  const invalidSchedule = Boolean(startAt && dueAt && new Date(dueAt).getTime() <= new Date(startAt).getTime());

  return (
    <Overlay open title="➕ Tạo Nhiệm Vụ Mới" onClose={onCancel} footer={<><button type="button" className="btn-danger" onClick={onCancel}>Hủy bỏ</button><button form="create-task-form" className="btn-primary" disabled={!projectId || collaboratorsLoading || invalidSchedule}>Tạo nhiệm vụ</button></>}>
    <form id="create-task-form"
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "100%" }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!project?.repositoryFullName || invalidSchedule) return;
        const created = await api<Task>("/tasks", {
          method: "POST",
          body: JSON.stringify({
            title,
            priority,
            projectId: project._id,
            repository: project.repositoryFullName,
            assignee,
            startAt: startAt ? new Date(startAt).toISOString() : undefined,
            dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
            labels: labels.split(",").map((item) => item.trim()).filter(Boolean),
          }),
        });
        setTitle("");
        setLabels("");
        setAssignee("");
        setStartAt("");
        setDueAt("");
        setCreatedCode(created.code || "");
      }}
    >
      {createdCode && (
        <div className="toast-message" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <span>✅ Đã tạo <strong>{createdCode}</strong> — dán mã này vào tiêu đề hoặc mô tả Pull Request tương ứng.</span>
          <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={onCreated}>Xong</button>
        </div>
      )}

      <div className="form-grid">
        <div>
          <label style={labelStyle}>Tiêu đề nhiệm vụ *</label>
          <input required placeholder="Nhập tiêu đề nhiệm vụ..." value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Repository *</label>
          <select required value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Chọn repository...</option>
            {projects.map((item) => <option key={item._id} value={item._id}>{item.repositoryFullName}</option>)}
          </select>
        </div>
      </div>

      <div className="form-grid">
        <div className="assignee-picker">
          <label style={labelStyle}>Người thực hiện</label>
          <button
            type="button"
            className="assignee-trigger"
            aria-expanded={assigneeOpen}
            aria-haspopup="listbox"
            disabled={!projectId || collaboratorsLoading}
            onClick={() => setAssigneeOpen((open) => !open)}
          >
            {collaboratorsLoading ? "Đang tải thành viên..." : selectedCollaborator ? `@${selectedCollaborator.login}` : "Chưa giao"}
            <span aria-hidden="true">⌄</span>
          </button>
          {assigneeOpen && (
            <div className="assignee-options" role="listbox" aria-label="Người thực hiện trong repository">
              <button type="button" role="option" aria-selected={!assignee} onClick={() => { setAssignee(""); setAssigneeOpen(false); }}>Chưa giao</button>
              {collaborators.map((item) => (
                <button type="button" role="option" aria-selected={assignee === item.login} key={item.login} onClick={() => { setAssignee(item.login); setAssigneeOpen(false); }}>
                  <img src={item.avatarUrl} alt="" />
                  <span><strong>{item.name || item.login}</strong><small>@{item.login}</small></span>
                </button>
              ))}
            </div>
          )}
          {collaboratorsError && <small className="field-error">{collaboratorsError}. Bạn vẫn có thể tạo task ở trạng thái chưa giao.</small>}
        </div>
        <div>
          <label style={labelStyle}>Độ ưu tiên</label>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {["low", "medium", "high", "urgent"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label style={labelStyle}>Thời gian bắt đầu</label>
          <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Hạn chót</label>
          <input type="datetime-local" min={startAt || undefined} value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          {invalidSchedule && <small className="field-error">Hạn chót phải sau thời gian bắt đầu.</small>}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Nhãn (ngăn cách bằng dấu phẩy)</label>
        <input placeholder="VD: bug, core, frontend" value={labels} onChange={(event) => setLabels(event.target.value)} />
      </div>

    </form>
    </Overlay>
  );
}
