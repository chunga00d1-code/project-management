import { useState } from "react";
import { api } from "../../api/client";
import type { Task } from "../../types";
import { EditTask } from "./EditTask";
import { Overlay } from "../../components/overlay/Overlay";

export function TaskDetail({ task, onClose, onChange }: { task: Task; onClose: () => void; onChange: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState("");
  const [itemText, setItemText] = useState("");

  const changed = () => {
    onChange();
  };

  return (
    <Overlay open title={task.title} onClose={onClose} footer={isEditing ? <><button type="button" className="btn-danger" onClick={() => setIsEditing(false)}>Hủy bỏ</button><button form="edit-task-form" className="btn-primary">Lưu thay đổi</button></> : <button className="btn-close" onClick={onClose}>Đóng hộp thoại</button>}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h2>{task.title}</h2>
          <div className="task-meta" style={{ marginTop: "0.25rem" }}>
            <span className={`badge-priority ${task.priority}`}>{task.priority.toUpperCase()}</span>
            <span className="pill" style={{ textTransform: "capitalize" }}>Trạng thái: {task.status}</span>
            {task.project && <span>📁 {task.project}</span>}
            {task.repository && <span>⌘ {task.repository}</span>}
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "Xem chi tiết" : "✏️ Sửa"}
        </button>
      </div>

      {isEditing ? (
        <EditTask
          task={task}
          onDone={() => {
            setIsEditing(false);
            changed();
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {task.description && (
            <div className="project-card" style={{ padding: "1.25rem", margin: 0 }}>
              <h4 style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Mô tả</h4>
              <p style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{task.description}</p>
            </div>
          )}

          <div className="grid-2" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
            {/* Left side: Checklist */}
            <div>
              <h3>📋 Checklist</h3>
              <ul style={{ maxHeight: "250px", overflowY: "auto", marginBottom: "0.75rem", paddingRight: "0.25rem" }}>
                {(task.checklist || []).map((item) => (
                  <li key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={async (e) => {
                        await api(`/tasks/${task._id}/checklist/${item.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ done: e.target.checked }),
                        });
                        changed();
                      }}
                    />
                    <span style={{ textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--text-muted)" : "var(--text-primary)" }}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
              <form
                style={{ display: "flex", gap: "0.5rem" }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/tasks/${task._id}/checklist`, {
                    method: "POST",
                    body: JSON.stringify({ text: itemText }),
                  });
                  setItemText("");
                  changed();
                }}
              >
                <input
                  required
                  maxLength={500}
                  value={itemText}
                  onChange={(e) => setItemText(e.target.value)}
                  placeholder="Thêm checklist..."
                  style={{ padding: "0.5rem" }}
                />
                <button className="btn-primary" style={{ width: "auto", padding: "0.5rem 1rem" }}>Thêm</button>
              </form>
            </div>

            {/* Right side: Relations */}
            <div>
              <h3>🔗 Liên kết & Thông tin</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.5rem 0" }}>
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Người thực hiện: </span>
                  <strong>{task.assignee || "Chưa giao"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Thời gian bắt đầu: </span>
                  <strong>{task.startAt ? new Date(task.startAt).toLocaleString("vi-VN") : "Không có"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Hạn chót: </span>
                  <strong>{task.dueAt ? new Date(task.dueAt).toLocaleString("vi-VN") : task.dueDate ? new Date(`${task.dueDate}T23:59:59`).toLocaleString("vi-VN") : "Không có"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Nhiệm vụ phụ thuộc: </span>
                  <span style={{ display: "inline-flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {(task.dependencies || []).length > 0 ? (
                      (task.dependencies || []).map((dep) => (
                        <span key={dep} className="pill" style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}>{dep}</span>
                      ))
                    ) : (
                      "Không có"
                    )}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Người theo dõi: </span>
                  <span style={{ display: "inline-flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {(task.watchers || []).length > 0 ? (
                      (task.watchers || []).map((w) => (
                        <span key={w} className="pill" style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}>{w}</span>
                      ))
                    ) : (
                      "Không có"
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3>💬 Bình luận ({task.comments.length})</h3>
            <ul style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "200px", overflowY: "auto", marginBottom: "1rem", paddingRight: "0.25rem" }}>
              {task.comments.map((comment) => (
                <li
                  key={comment.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                    padding: "0.75rem",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <strong>{comment.author}</strong>
                    <span>{comment.at ? new Date(comment.at).toLocaleString("vi-VN") : ""}</span>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{comment.text}</div>
                </li>
              ))}
            </ul>
            <form
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/tasks/${task._id}/comments`, {
                  method: "POST",
                  body: JSON.stringify({ text }),
                });
                setText("");
                changed();
              }}
            >
              <textarea
                required
                maxLength={5000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Viết bình luận của bạn..."
                style={{ padding: "0.75rem", minHeight: "60px" }}
              />
              <button className="btn-primary" style={{ alignSelf: "flex-end", width: "auto", padding: "0.5rem 1.5rem" }}>
                Gửi bình luận
              </button>
            </form>
          </div>
        </div>
      )}
    </Overlay>
  );
}
